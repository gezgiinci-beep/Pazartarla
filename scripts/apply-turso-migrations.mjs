import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTursoConnection, getTursoConfiguration } from '../server/turso.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(root, 'database', 'turso-migrations');

async function applyMigrations() {
  const { url } = getTursoConfiguration();
  const hostname = new URL(url).hostname.toLowerCase();
  if (!hostname.includes('pazartarla-migration-test') &&
      !process.argv.includes('--allow-non-test-database')) {
    throw new Error('Refusing to migrate a non-test database without an explicit command-line approval.');
  }
  const database = createTursoConnection();
  await database.exec(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const name of migrationNames) {
    const existing = await database.get(
      'SELECT name FROM app_schema_migrations WHERE name = ?',
      name,
    );
    if (existing) {
      process.stdout.write(`Zaten uygulanmış: ${name}\n`);
      continue;
    }

    const sql = await readFile(join(migrationsDirectory, name), 'utf8');
    await database.exec('BEGIN IMMEDIATE');
    try {
      await database.exec(sql);
      await database.run(
        'INSERT INTO app_schema_migrations(name) VALUES (?)',
        name,
      );
      await database.exec('COMMIT');
      process.stdout.write(`Uygulandı: ${name}\n`);
    } catch (error) {
      await database.exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
}

applyMigrations().catch(error => {
  const message = error?.code === 'TURSO_NOT_CONFIGURED'
    ? 'TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN henüz tanımlı değil.'
    : 'Turso şema geçişi tamamlanamadı; hata ayrıntıları güvenlik için gizlendi.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
