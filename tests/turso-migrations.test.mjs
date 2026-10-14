import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const migrationPath = new URL('../database/turso-migrations/0002_store_publication.sql', import.meta.url);
const authLimitsMigrationPath = new URL('../database/turso-migrations/0003_auth_action_limits.sql', import.meta.url);
const applicationSchemaMigrationPath = new URL('../database/turso-migrations/0000_application_tables.sql', import.meta.url);
const coreMigrationPath = new URL('../database/turso-migrations/0001_core.sql', import.meta.url);

test('fresh Turso database receives the imported application schema before later migrations', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    const applicationSchema = await readFile(fileURLToPath(applicationSchemaMigrationPath), 'utf8');
    const coreSchema = await readFile(fileURLToPath(coreMigrationPath), 'utf8');
    const storePublication = await readFile(fileURLToPath(migrationPath), 'utf8');
    const authLimits = await readFile(fileURLToPath(authLimitsMigrationPath), 'utf8');

    database.exec(applicationSchema);
    database.exec(applicationSchema);
    database.exec(coreSchema);
    database.exec(storePublication);
    database.exec(authLimits);

    const tables = new Set(database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table'
    `).all().map(row => row.name));
    for (const name of [
      'app_users',
      'auth_sessions',
      'auth_action_tokens',
      'listings',
      'site_settings',
      'advertisements',
      'private__listing_admins',
      'private__listing_submission_log',
      'private__listing_offers',
      'private__listing_offer_messages',
      'private__store_memberships',
      'private__store_plans',
      'private__traffic_views',
      'private__depot_contacts',
      'auth_action_limits',
    ]) assert.ok(tables.has(name), `missing ${name}`);

    const storeColumns = database.prepare('PRAGMA table_info(private__member_stores)').all();
    assert.ok(storeColumns.some(column => column.name === 'is_public'));
    assert.equal(
      database.prepare(`
        SELECT COUNT(*) AS count FROM sqlite_master
         WHERE type = 'index' AND name = 'private__listing_offers_buyer_time_idx'
      `).get().count,
      1,
    );
  } finally {
    database.close();
  }
});

test('store publication migration preserves old stores as public and restricts values', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE private__member_stores (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO private__member_stores(id, owner_id, name, description)
      VALUES ('store-one', 'owner-one', 'Mevcut mağaza', '');
    `);
    const migration = await readFile(fileURLToPath(migrationPath), 'utf8');
    database.exec(migration);

    assert.equal(
      database.prepare('SELECT is_public FROM private__member_stores WHERE id = ?').get('store-one').is_public,
      1,
    );
    database.prepare(`INSERT INTO private__member_stores(
      id, owner_id, name, description, is_public
    ) VALUES(?, ?, ?, ?, ?)`).run('store-two', 'owner-two', 'Gizli mağaza', '', 0);
    assert.equal(
      database.prepare('SELECT is_public FROM private__member_stores WHERE id = ?').get('store-two').is_public,
      0,
    );
    assert.throws(() => database.prepare(`INSERT INTO private__member_stores(
      id, owner_id, name, description, is_public
    ) VALUES(?, ?, ?, ?, ?)`).run('store-three', 'owner-three', 'Geçersiz', '', 2));
    assert.equal(database.prepare(
      `SELECT COUNT(*) AS count FROM sqlite_master
        WHERE type = 'index' AND name = 'private__member_stores_public_name_idx'`,
    ).get().count, 1);
  } finally {
    database.close();
  }
});

test('auth action rate-limit migration stores only scoped hashes and expires old windows', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    const migration = await readFile(fileURLToPath(authLimitsMigrationPath), 'utf8');
    database.exec(migration);
    database.prepare(`
      INSERT INTO auth_action_limits(action, subject_hash, window_started_at, attempts)
      VALUES (?, ?, ?, ?)
    `).run('request_password_reset', 'hashed-subject', 1_797_000_000, 1);
    assert.equal(
      database.prepare('SELECT attempts FROM auth_action_limits WHERE subject_hash = ?')
        .get('hashed-subject').attempts,
      1,
    );
    assert.throws(() => database.prepare(`
      INSERT INTO auth_action_limits(action, subject_hash, window_started_at, attempts)
      VALUES (?, ?, ?, ?)
    `).run('invalid-action', 'hash', 1, 1));
    assert.equal(database.prepare(`
      SELECT COUNT(*) AS count FROM sqlite_master
       WHERE type = 'index' AND name = 'auth_action_limits_window_idx'
    `).get().count, 1);
  } finally {
    database.close();
  }
});
