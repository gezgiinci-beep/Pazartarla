import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  mutateTursoContactDepot,
  readTursoContactDepot,
  unsubscribeTursoContact,
} from '../server/tursoContactDepot.js';
import {
  mutateTursoAdvertisement,
  readTursoAdvertisement,
  readTursoAdvertisements,
} from '../server/tursoAdvertisements.js';
import { createTursoAdvertisementMediaUploadHandler } from '../server/tursoAdvertisementMedia.js';

const NOW = new Date('2026-10-14T09:00:00.000Z');
const ADMIN = { user: { id: 'admin-test' }, is_admin: true, admin_reauth_at: NOW.toISOString() };

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE private__depot_campaigns (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, channel TEXT NOT NULL, subject TEXT NOT NULL,
      body TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, created_by TEXT
    );
    CREATE TABLE private__depot_contacts (
      id TEXT PRIMARY KEY, identity_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      email TEXT, phone TEXT, raw_phone TEXT, manual INTEGER NOT NULL,
      from_listing INTEGER NOT NULL, archived INTEGER NOT NULL, revision INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_deliveries (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, contact_id TEXT NOT NULL,
      destination TEXT NOT NULL, status TEXT NOT NULL, lease TEXT, lease_until TEXT,
      provider_id TEXT, updated_at TEXT NOT NULL, UNIQUE(campaign_id, destination)
    );
    CREATE TABLE private__depot_import_receipts (
      request_id TEXT PRIMARY KEY, actor TEXT NOT NULL, input_hash TEXT NOT NULL,
      result TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_optout_links (
      token TEXT PRIMARY KEY, channel TEXT NOT NULL, destination TEXT NOT NULL
    );
    CREATE TABLE private__depot_permission_events (
      id INTEGER PRIMARY KEY, contact_id TEXT NOT NULL, channel TEXT NOT NULL,
      status TEXT NOT NULL, evidence TEXT NOT NULL, actor TEXT, recorded_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_permissions (
      contact_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL,
      evidence TEXT NOT NULL, updated_at TEXT, unsubscribe_token TEXT NOT NULL UNIQUE,
      PRIMARY KEY(contact_id, channel)
    );
    CREATE TABLE private__depot_sources (
      listing_id INTEGER PRIMARY KEY, contact_id TEXT NOT NULL, captured_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_suppressions (
      channel TEXT NOT NULL, destination TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(channel, destination)
    );
    CREATE TABLE advertisements (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, target_url TEXT, media_path TEXT NOT NULL,
      media_type TEXT NOT NULL, is_active INTEGER NOT NULL, revision INTEGER NOT NULL,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const db = {
    get: async (sql, ...params) => sqlite.prepare(sql).get(...params),
    all: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    run: async (sql, ...params) => sqlite.prepare(sql).run(...params),
  };
  db.transactionAsync = callback => ({
    immediate: async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await callback(db);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  });
  db.close = () => sqlite.close();
  return db;
}

test('Turso contact depot preserves permission audit, suppression, blocked campaigns and idempotent imports', async () => {
  const db = database();
  const first = await mutateTursoContactDepot(db, ADMIN, 'save_depot_contact', {
    p_name: 'Üye Bir', p_email: 'same@example.test', p_phone: '05551112233',
  }, NOW);
  const second = await mutateTursoContactDepot(db, ADMIN, 'save_depot_contact', {
    p_name: 'Üye İki', p_email: 'same@example.test', p_phone: '05552223344',
  }, NOW);
  await mutateTursoContactDepot(db, ADMIN, 'set_depot_permission', {
    p_id: first, p_revision: 1, p_channel: 'email', p_grant: true, p_evidence: 'Yazılı onay 2026-10-14',
  }, NOW);
  const campaign = await mutateTursoContactDepot(db, ADMIN, 'queue_depot_campaign', {
    p_name: 'Test duyurusu', p_channel: 'email', p_subject: 'Duyuru',
    p_body: 'Test içeriği', p_scheduled_at: NOW.toISOString(),
  }, NOW);
  assert.equal((await db.get('SELECT status FROM private__depot_campaigns WHERE id = ?', campaign)).status, 'blocked_provider');
  assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM private__depot_deliveries WHERE campaign_id = ?', campaign)).n), 1);

  await mutateTursoContactDepot(db, ADMIN, 'set_depot_permission', {
    p_id: first, p_revision: 2, p_channel: 'email', p_grant: false, p_evidence: '',
  }, NOW);
  const result = await readTursoContactDepot(db);
  const duplicate = result.contacts.find(contact => contact.id === second);
  assert.equal(duplicate.permissions.email.status, 'revoked');
  assert.equal(result.channels.every(channel => !channel.enabled && channel.provider === null), true);
  assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM private__depot_suppressions WHERE channel = ?', 'email')).n), 1);
  assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM private__depot_deliveries WHERE campaign_id = ? AND status = ?', campaign, 'cancelled')).n), 1);

  const rows = [{ row: 2, name: 'İçe Aktarılan', email: 'new@example.test', phone: '' }];
  const preview = await mutateTursoContactDepot(db, ADMIN, 'preview_depot_import', { p_rows: rows }, NOW);
  assert.equal(preview[0].status, 'ready');
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:2';
  const imported = await mutateTursoContactDepot(db, ADMIN, 'import_depot_contacts', {
    p_rows: rows, p_request_id: requestId,
  }, NOW);
  assert.equal(imported[0].status, 'imported');
  assert.deepEqual(await mutateTursoContactDepot(db, ADMIN, 'import_depot_contacts', {
    p_rows: rows, p_request_id: requestId,
  }, NOW), imported);
  await assert.rejects(mutateTursoContactDepot(db, ADMIN, 'import_depot_contacts', {
    p_rows: [{ ...rows[0], name: 'Farklı içerik' }], p_request_id: requestId,
  }, NOW), error => error.code === 'CONTACT_IMPORT_CHANGED');

  const token = await db.get(
    `SELECT p.unsubscribe_token AS token FROM private__depot_permissions p
      WHERE p.contact_id = ? AND p.channel = 'email'`, second,
  );
  assert.equal(await unsubscribeTursoContact(db, token.token, NOW), true);
  assert.equal((await db.get(
    `SELECT status FROM private__depot_permissions WHERE contact_id = ? AND channel = 'email'`, second,
  )).status, 'revoked');
  db.close();
});

test('Turso advertisement records stay unpublished on create, use revision conflicts, and delete explicitly', async () => {
  const db = database();
  const id = '00000000-0000-4000-8000-000000000101';
  const asset = `${id}/00000000-0000-4000-8000-000000000102.jpg`;
  const created = await mutateTursoAdvertisement(db, ADMIN, 'POST', {
    id, title: 'Test reklam', target_url: null, media_path: asset, media_type: 'image', is_active: true,
  }, NOW);
  assert.equal(created.is_active, false);
  assert.equal((await readTursoAdvertisements(db)).length, 1);
  const published = await mutateTursoAdvertisement(db, ADMIN, 'PATCH', {
    id, revision: created.revision, title: 'Test reklam', target_url: null,
    media_path: asset, media_type: 'image', is_active: true,
  }, NOW);
  assert.equal(published.is_active, true);
  assert.equal(published.revision, 2);
  await assert.rejects(mutateTursoAdvertisement(db, ADMIN, 'PATCH', {
    id, revision: 1, title: 'Stale', target_url: null, media_path: asset, media_type: 'image',
  }, NOW), error => error.code === 'AD_CONFLICT' && error.status === 409);
  assert.equal((await readTursoAdvertisement(db, id)).title, 'Test reklam');
  const removed = await mutateTursoAdvertisement(db, ADMIN, 'DELETE', { id, revision: 2 }, NOW);
  assert.deepEqual(removed, { id, deleted: true });
  assert.equal(await readTursoAdvertisement(db, id), null);
  db.close();
});

test('ad-media upload requires same-origin admin auth and checks real file signatures and size', async () => {
  const db = database();
  const stored = [];
  const handler = createTursoAdvertisementMediaUploadHandler({
    connect: () => db,
    authenticate: async () => ({ database: db, session: ADMIN, currentTime: NOW }),
    storageConfigured: true,
    putBlob: async (pathname, bytes, options) => {
      stored.push({ pathname, bytes: Buffer.from(bytes), options });
      return { url: `https://store.public.blob.vercel-storage.com/${pathname}` };
    },
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  const id = '00000000-0000-4000-8000-000000000201';
  const request = {
    method: 'POST', query: { id },
    headers: {
      origin: 'https://pazartarla.example', host: 'pazartarla.example',
      'x-forwarded-proto': 'https', 'content-type': 'image/png',
    },
    body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  };
  await handler(request, response);
  assert.equal(response.statusCode, 201);
  assert.match(response.body.media_path, new RegExp(`/${id}/`));
  assert.equal(response.body.media_type, 'image');
  assert.equal(stored.length, 1);
  const invalid = { ...request, body: Buffer.from('not an image') };
  const rejected = {
    headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; },
  };
  await handler(invalid, rejected);
  assert.equal(rejected.statusCode, 400);
  assert.equal(stored.length, 1);
  db.close();
});
