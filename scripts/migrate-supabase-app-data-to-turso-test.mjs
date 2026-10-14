import { Client as PgClient } from 'pg';
import { createTursoConnection, getTursoConfiguration } from '../server/turso.js';

const SOURCE_SCHEMAS = ['public', 'private'];
const TEST_DATABASE_MARKER = 'pazartarla-migration-test';
const PRODUCTION_DATABASE_HOST = 'pazartarla-production-pazartarla.aws-eu-north-1.turso.io';
const MANIFEST_TABLE = 'pazartarla_migration_manifest';
const BATCH_SIZE = 40;

function quoteIdentifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('Beklenmeyen veritabanı tanımlayıcısı.');
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function targetTableName(schema, table) {
  return schema === 'public' ? table : `private__${table}`;
}

function sqliteType(udtName) {
  if (['bool', 'int2', 'int4', 'int8'].includes(udtName)) return 'INTEGER';
  if (['float4', 'float8'].includes(udtName)) return 'REAL';
  if (udtName === 'bytea') return 'BLOB';
  if (udtName === 'numeric') return 'NUMERIC';
  return 'TEXT';
}

function toSqliteValue(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function getSourceCatalog(pg) {
  const tables = await pg.query(
    `SELECT schemaname AS schema_name, tablename AS table_name
       FROM pg_tables
      WHERE schemaname = ANY($1::text[])
      ORDER BY schemaname, tablename`,
    [SOURCE_SCHEMAS],
  );
  const columns = await pg.query(
    `SELECT table_schema, table_name, column_name, udt_name, is_nullable,
            ordinal_position
       FROM information_schema.columns
      WHERE table_schema = ANY($1::text[])
      ORDER BY table_schema, table_name, ordinal_position`,
    [SOURCE_SCHEMAS],
  );
  const constraints = await pg.query(
    `SELECT n.nspname AS schema_name, t.relname AS table_name, c.contype,
            json_agg(a.attname ORDER BY k.ordinality) AS column_names
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = ANY($1::text[])
        AND c.contype IN ('p', 'u')
      GROUP BY n.nspname, t.relname, c.contype, c.conname
      ORDER BY n.nspname, t.relname, c.contype, c.conname`,
    [SOURCE_SCHEMAS],
  );

  const columnMap = new Map();
  for (const column of columns.rows) {
    const key = `${column.table_schema}.${column.table_name}`;
    const group = columnMap.get(key) || [];
    group.push(column);
    columnMap.set(key, group);
  }

  const constraintMap = new Map();
  for (const constraint of constraints.rows) {
    const key = `${constraint.schema_name}.${constraint.table_name}`;
    const group = constraintMap.get(key) || [];
    group.push(constraint);
    constraintMap.set(key, group);
  }

  return tables.rows.map(({ schema_name: schema, table_name: table }) => {
    const key = `${schema}.${table}`;
    const tableColumns = columnMap.get(key) || [];
    const tableConstraints = constraintMap.get(key) || [];
    const primaryKey = tableConstraints.find(item => item.contype === 'p')?.column_names;
    if (!tableColumns.length || !primaryKey?.length) {
      throw new Error(`Kaynak tablo şeması eksik: ${schema}.${table}`);
    }
    return {
      schema,
      table,
      target: targetTableName(schema, table),
      columns: tableColumns,
      primaryKey,
      uniqueConstraints: tableConstraints
        .filter(item => item.contype === 'u')
        .map(item => item.column_names),
    };
  });
}

function createTableSql(table) {
  const columns = table.columns.map(column => {
    const nullable = column.is_nullable === 'NO' ? ' NOT NULL' : '';
    return `${quoteIdentifier(column.column_name)} ${sqliteType(column.udt_name)}${nullable}`;
  });
  columns.push(`PRIMARY KEY (${table.primaryKey.map(quoteIdentifier).join(', ')})`);
  for (const uniqueColumns of table.uniqueConstraints) {
    columns.push(`UNIQUE (${uniqueColumns.map(quoteIdentifier).join(', ')})`);
  }
  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.target)} (${columns.join(', ')})`;
}

async function targetTableExists(database, tableName) {
  return Boolean(await database.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName,
  ));
}

async function ensureTargetSchema(database, table) {
  let actual = await database.all(`PRAGMA table_info(${quoteIdentifier(table.target)})`);
  let actualNames = new Set(actual.map(column => column.name));
  for (const column of table.columns) {
    if (actualNames.has(column.column_name)) continue;
    const nullable = column.is_nullable === 'NO' ? ' NOT NULL' : '';
    await database.exec(
      `ALTER TABLE ${quoteIdentifier(table.target)} ADD COLUMN ` +
      `${quoteIdentifier(column.column_name)} ${sqliteType(column.udt_name)}${nullable}`,
    );
  }

  actual = await database.all(`PRAGMA table_info(${quoteIdentifier(table.target)})`);
  actualNames = new Set(actual.map(column => column.name));
  const expectedNames = table.columns.map(column => column.column_name);
  if (!expectedNames.every(name => actualNames.has(name))) {
    throw new Error(`Hedef tablo sütunları uyuşmuyor: ${table.target}`);
  }
  const actualPrimaryKey = actual
    .filter(column => Number(column.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map(column => column.name);
  if (JSON.stringify(actualPrimaryKey) !== JSON.stringify(table.primaryKey)) {
    throw new Error(`Hedef tablo anahtarı uyuşmuyor: ${table.target}`);
  }
}

function makeUpsert(table) {
  const names = table.columns.map(column => column.column_name);
  const quotedNames = names.map(quoteIdentifier);
  const conflict = table.primaryKey.map(quoteIdentifier).join(', ');
  const nonKeyColumns = names.filter(name => !table.primaryKey.includes(name));
  const action = nonKeyColumns.length
    ? `DO UPDATE SET ${nonKeyColumns.map(name =>
      `${quoteIdentifier(name)} = excluded.${quoteIdentifier(name)}`).join(', ')}`
    : 'DO NOTHING';
  return `INSERT INTO ${quoteIdentifier(table.target)} (${quotedNames.join(', ')}) ` +
    `VALUES (${names.map(() => '?').join(', ')}) ON CONFLICT (${conflict}) ${action}`;
}

async function migrate() {
  let stage = 'configuration';
  const config = getTursoConfiguration();
  const targetHost = new URL(config.url).hostname;
  const isTestTarget = targetHost.startsWith(`${TEST_DATABASE_MARKER}-`) &&
    targetHost.endsWith('.turso.io');
  const isApprovedProductionTarget = targetHost === PRODUCTION_DATABASE_HOST &&
    process.argv.includes('--target-production');
  if (!isTestTarget && !isApprovedProductionTarget) {
    throw new Error('Güvenlik denetimi başarısız: hedef migration-test Turso veritabanı değil.');
  }
  if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error('Supabase salt okunur bağlantı ayarı bulunamadı.');
  }

  const pg = new PgClient({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    application_name: 'pazartarla-app-data-migration-to-turso-test',
  });
  const turso = createTursoConnection();

  try {
    stage = 'source-connect';
    await pg.connect();
    stage = 'source-snapshot';
    await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    stage = 'source-catalog';
    const tables = await getSourceCatalog(pg);
    if (!tables.length) throw new Error('Taşınacak uygulama tablosu bulunamadı.');

    stage = 'target-preflight';
    const hadManifest = await targetTableExists(turso, MANIFEST_TABLE);
    if (!hadManifest) {
      for (const table of tables) {
        if (await targetTableExists(turso, table.target)) {
          const existing = await turso.get(
            `SELECT count(*) AS row_count FROM ${quoteIdentifier(table.target)}`,
          );
          if (Number(existing.row_count) !== 0) {
            throw new Error(`Hedefte beklenmeyen kayıt bulundu: ${table.target}`);
          }
        }
      }
    }

    stage = 'target-manifest';
    await turso.exec(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(MANIFEST_TABLE)} (
        source_schema TEXT NOT NULL,
        source_table TEXT NOT NULL,
        target_table TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        verified_at TEXT NOT NULL,
        PRIMARY KEY (source_schema, source_table)
      )
    `);

    const sourceRowsByTable = [];
    stage = 'source-read';
    for (const table of tables) {
      const selectColumns = table.columns.map(column =>
        quoteIdentifier(column.column_name)).join(', ');
      const result = await pg.query(
        `SELECT ${selectColumns} FROM ${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)}`,
      );
      sourceRowsByTable.push({ table, rows: result.rows });
    }
    await pg.query('COMMIT');

    const completed = [];
    for (const { table, rows } of sourceRowsByTable) {
      stage = `target-schema:${table.target}`;
      if (!(await targetTableExists(turso, table.target))) {
        await turso.exec(createTableSql(table));
      }
      await ensureTargetSchema(turso, table);

      const insertSql = makeUpsert(table);
      stage = `target-write:${table.target}`;
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const statements = rows.slice(offset, offset + BATCH_SIZE).map(row => ({
          sql: insertSql,
          args: table.columns.map(column => toSqliteValue(row[column.column_name])),
        }));
        if (statements.length) await turso.batch(statements, 'write');
      }

      const targetCount = await turso.get(
        `SELECT count(*) AS row_count FROM ${quoteIdentifier(table.target)}`,
      );
      if (Number(targetCount.row_count) !== rows.length) {
        throw new Error(`Kayıt sayısı doğrulanamadı: ${table.target}`);
      }

      stage = `target-verify:${table.target}`;
      await turso.run(
        `INSERT INTO ${quoteIdentifier(MANIFEST_TABLE)}
          (source_schema, source_table, target_table, row_count, verified_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (source_schema, source_table) DO UPDATE SET
           target_table = excluded.target_table,
           row_count = excluded.row_count,
           verified_at = excluded.verified_at`,
        table.schema,
        table.table,
        table.target,
        rows.length,
        new Date().toISOString(),
      );
      completed.push({ table: `${table.schema}.${table.table}`, rows: rows.length });
    }

    const totalRows = completed.reduce((sum, item) => sum + item.rows, 0);
    process.stdout.write(JSON.stringify({
      target: isApprovedProductionTarget ? 'pazartarla-production' : 'pazartarla-migration-test',
      scope: 'application tables in public/private schemas only',
      tables: completed.length,
      rows: totalRows,
      verified: completed,
      excluded: ['Supabase Auth internals', 'Storage file bytes', 'Realtime internals', 'views and functions'],
    }) + '\n');
  } catch (error) {
    await pg.query('ROLLBACK').catch(() => {});
    const message = error?.message?.startsWith('Kaynak tablo') ||
      error?.message?.startsWith('Hedef') ||
      error?.message?.startsWith('Güvenlik') ||
      error?.message?.startsWith('Taşınacak')
      ? error.message
      : 'Taşıma durdu; hassas veri veya bağlantı ayrıntıları güvenlik için gizlendi.';
    const schemaDiagnostic = stage.startsWith('target-schema') && error instanceof TypeError
      ? `; ${String(error.message || '').slice(0, 160)}`
      : '';
    process.stderr.write(`${message} (${stage}; ${error?.name || 'Error'}; ${error?.code || 'no-code'}${schemaDiagnostic})\n`);
    process.exitCode = 1;
  } finally {
    await pg.end().catch(() => {});
  }
}

await migrate();
