import { Client as PgClient } from 'pg';
import { createTursoConnection, getTursoConfiguration } from '../server/turso.js';

const TARGET_MARKER = 'pazartarla-migration-test';
const PRODUCTION_DATABASE_HOST = 'pazartarla-production-pazartarla.aws-eu-north-1.turso.io';
const MANIFEST_TABLE = 'pazartarla_auth_migration_manifest';

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

async function exists(database, name) {
  return Boolean(await database.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    name,
  ));
}

async function migrate() {
  const config = getTursoConfiguration();
  const hostname = new URL(config.url).hostname;
  const isTestTarget = hostname.startsWith(`${TARGET_MARKER}-`) && hostname.endsWith('.turso.io');
  const isApprovedProductionTarget = hostname === PRODUCTION_DATABASE_HOST &&
    process.argv.includes('--target-production');
  if (!isTestTarget && !isApprovedProductionTarget) {
    throw new Error('Güvenlik denetimi başarısız: hedef migration-test veritabanı değil.');
  }
  const turso = createTursoConnection();
  let pg;
  let stage = 'target-preflight';

  try {
    if (await exists(turso, MANIFEST_TABLE)) {
      const previous = await turso.get(
        `SELECT migration_name FROM ${MANIFEST_TABLE} WHERE migration_name = ?`,
        'supabase-auth-users-v1',
      );
      if (previous) {
        throw new Error('Auth aktarımı daha önce tamamlandı; mevcut test değişikliklerini ezmemek için yeniden çalıştırılmadı.');
      }
    }
    if (!process.env.SUPABASE_DATABASE_URL) {
      throw new Error('Supabase salt okunur bağlantısı yapılandırılmamış.');
    }

    pg = new PgClient({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
      application_name: 'pazartarla-auth-migration-to-turso-test',
    });
    stage = 'connect-source-read-only';
    await pg.connect();
    await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    stage = 'read-minimal-auth-records';
    const result = await pg.query(`
      SELECT id::text AS id, lower(trim(email)) AS email,
             encrypted_password AS password_hash,
             email_confirmed_at, created_at, updated_at,
             banned_until, deleted_at, is_anonymous
        FROM auth.users
       WHERE email IS NOT NULL
       ORDER BY id
    `);
    const users = result.rows.map(user => ({
      ...user,
      email: normalizedEmail(user.email),
      email_confirmed_at: toIso(user.email_confirmed_at),
      created_at: toIso(user.created_at),
      updated_at: toIso(user.updated_at),
      banned_until: toIso(user.banned_until),
      deleted_at: toIso(user.deleted_at),
      is_anonymous: user.is_anonymous ? 1 : 0,
    }));

    const emails = new Set();
    for (const user of users) {
      if (!user.id || !user.email || emails.has(user.email)) {
        throw new Error('Hesap kimliği/e-posta bütünlüğü doğrulanamadı.');
      }
      if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password_hash || '')) {
        throw new Error('Bir veya daha fazla parola özeti beklenen bcrypt biçiminde değil.');
      }
      emails.add(user.email);
    }
    await pg.query('COMMIT');

    stage = 'verify-admin-source-match';
    const adminRows = await turso.all(
      'SELECT lower(trim(email)) AS email FROM private__listing_admins',
    );
    const adminEmails = new Set(adminRows.map(row => row.email));
    const matchingAdminCount = users.filter(user =>
      adminEmails.has(user.email) && !user.deleted_at && !user.banned_until &&
      !user.is_anonymous).length;
    if (matchingAdminCount !== 1) {
      throw new Error('Kaynak hesap ve yönetici eşleşme sayıları doğrulanamadı.');
    }
    if (await exists(turso, 'app_users')) {
      const existing = await turso.get('SELECT count(*) AS rows FROM app_users');
      if (Number(existing.rows) !== 0) {
        throw new Error('Hedefte beklenmeyen hesap kaydı bulundu.');
      }
    }

    stage = 'create-auth-schema';
    await turso.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_confirmed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        banned_until TEXT,
        deleted_at TEXT,
        is_anonymous INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        admin_reauth_at TEXT
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_login_limits (
        subject_hash TEXT PRIMARY KEY,
        window_started_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_action_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS auth_action_tokens_user_purpose_idx
        ON auth_action_tokens(user_id, purpose);
      CREATE TABLE IF NOT EXISTS ${MANIFEST_TABLE} (
        migration_name TEXT PRIMARY KEY,
        account_count INTEGER NOT NULL,
        verified_count INTEGER NOT NULL,
        admin_count INTEGER NOT NULL,
        imported_at TEXT NOT NULL
      );
    `);

    stage = 'copy-auth-records';
    const insert = `
      INSERT INTO app_users (
        id, email, password_hash, email_confirmed_at, created_at,
        updated_at, banned_until, deleted_at, is_anonymous
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        email_confirmed_at = excluded.email_confirmed_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        banned_until = excluded.banned_until,
        deleted_at = excluded.deleted_at,
        is_anonymous = excluded.is_anonymous
    `;
    for (let offset = 0; offset < users.length; offset += 40) {
      const statements = users.slice(offset, offset + 40).map(user => ({
        sql: insert,
        args: [
          user.id, user.email, user.password_hash, user.email_confirmed_at,
          user.created_at, user.updated_at, user.banned_until, user.deleted_at,
          user.is_anonymous,
        ],
      }));
      if (statements.length) await turso.batch(statements, 'write');
    }

    stage = 'verify-auth-records';
    const totals = await turso.get(`
      SELECT count(*) AS accounts,
             count(email_confirmed_at) AS verified,
             count(*) FILTER (WHERE is_anonymous = 1) AS anonymous
        FROM app_users
    `);
    if (Number(totals.accounts) !== users.length ||
        Number(totals.verified) !== users.filter(user => user.email_confirmed_at).length) {
      throw new Error('Hesap veya yönetici eşleşme sayıları doğrulanamadı.');
    }

    await turso.run(
      `INSERT INTO ${MANIFEST_TABLE}
        (migration_name, account_count, verified_count, admin_count, imported_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(migration_name) DO UPDATE SET
         account_count = excluded.account_count,
         verified_count = excluded.verified_count,
         admin_count = excluded.admin_count,
         imported_at = excluded.imported_at`,
      'supabase-auth-users-v1',
      Number(totals.accounts),
      Number(totals.verified),
      matchingAdminCount,
      new Date().toISOString(),
    );

    process.stdout.write(JSON.stringify({
      target: isApprovedProductionTarget ? 'pazartarla-production' : 'pazartarla-migration-test',
      accounts: Number(totals.accounts),
      emailVerified: Number(totals.verified),
      matchingAdmins: matchingAdminCount,
      passwordHashes: 'bcrypt preserved',
      excluded: ['Supabase sessions and refresh tokens', 'email/recovery tokens', 'phone data', 'provider internals'],
    }) + '\n');
  } catch (error) {
    if (pg) await pg.query('ROLLBACK').catch(() => {});
    const safeMessage = error?.message?.startsWith('Güvenlik') ||
      error?.message?.startsWith('Supabase') ||
      error?.message?.startsWith('Hesap') ||
      error?.message?.startsWith('Bir veya') ||
      error?.message?.startsWith('Hedefte') ||
      error?.message?.startsWith('Auth aktarımı')
      ? error.message
      : 'Auth kopyası durdu; bağlantı ve hesap ayrıntıları güvenlik için gizlendi.';
    process.stderr.write(`${safeMessage} (${stage}; ${error?.name || 'Error'}; ${error?.code || 'no-code'})\n`);
    process.exitCode = 1;
  } finally {
    if (pg) await pg.end().catch(() => {});
  }
}

await migrate();
