import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  createTursoListing,
  listingExpiryAfterOneIstanbulYear,
  moderateTursoListing,
  readTursoAdminListingForEdit,
  readTursoOwnerListingForEdit,
  readTursoModerationQueue,
  updateTursoOwnerListingArchive,
  updateTursoOwnerListingDetails,
  updateTursoListingFeatured,
  updateTursoListingMedia,
} from '../server/tursoListingMutations.js';
import {
  createListingModerationHandler,
  createOwnerListingHandler,
  createSubmissionWriteHandler,
} from '../server/listingMutationHandlers.js';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const USER_SESSION = {
  user: { id: 'member-a', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
  is_admin: false,
};
const ADMIN_SESSION = {
  user: { id: 'admin-a', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
  is_admin: true,
  admin_reauth_at: NOW.toISOString(),
};
const OTHER_SESSION = {
  user: { id: 'member-b', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
  is_admin: false,
};

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, price REAL NOT NULL,
      category TEXT NOT NULL, "subCategory" TEXT NOT NULL, mode TEXT NOT NULL,
      location TEXT, amount TEXT, description TEXT, seller TEXT NOT NULL,
      phone TEXT NOT NULL, image TEXT, seotags TEXT, status TEXT NOT NULL,
      created_at TEXT NOT NULL, submitted_by TEXT NOT NULL, expires_at TEXT NOT NULL,
      is_featured INTEGER NOT NULL DEFAULT 0, gallery_paths TEXT
    );
    CREATE TABLE site_settings (id TEXT PRIMARY KEY, categories TEXT NOT NULL);
    CREATE TABLE private__store_memberships (
      owner_id TEXT, plan_name TEXT, monthly_limit INTEGER, active_limit INTEGER,
      starts_at TEXT, ends_at TEXT, billing_period TEXT
    );
    CREATE TABLE private__listing_submission_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, submitted_at TEXT
    );
    CREATE TABLE private__listing_offer_settings (
      listing_id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_contacts (
      id TEXT PRIMARY KEY, identity_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      email TEXT, phone TEXT, raw_phone TEXT, manual INTEGER NOT NULL,
      from_listing INTEGER NOT NULL, archived INTEGER NOT NULL, revision INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE private__depot_permissions (
      contact_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL,
      evidence TEXT NOT NULL, updated_at TEXT, unsubscribe_token TEXT NOT NULL UNIQUE,
      PRIMARY KEY(contact_id, channel)
    );
    CREATE TABLE private__depot_optout_links (
      token TEXT PRIMARY KEY, channel TEXT NOT NULL, destination TEXT NOT NULL
    );
    CREATE TABLE private__depot_sources (
      listing_id INTEGER PRIMARY KEY, contact_id TEXT NOT NULL, captured_at TEXT NOT NULL
    );
  `);
  sqlite.prepare(`INSERT INTO site_settings(id, categories) VALUES ('public', ?)`)
    .run(JSON.stringify({ Equipment: ['Tractor', 'Seeder'] }));

  const database = {
    get: async (sql, ...params) => sqlite.prepare(sql).get(...params),
    all: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    run: async (sql, ...params) => sqlite.prepare(sql).run(...params),
  };
  database.transactionAsync = callback => ({
    immediate: async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await callback(database);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  });
  return { database, sqlite };
}

function payload(overrides = {}) {
  return {
    title: 'Tractor listing',
    price: 125000,
    category: 'Equipment',
    subCategory: 'Tractor',
    mode: 'Satılık',
    location: 'Balıkesir',
    description: 'Well maintained',
    seller: 'Seller name',
    phone: '+905551112233',
    images: ['https://images.example.test/tractor.jpg'],
    seoTags: 'tractor, farm',
    ...overrides,
  };
}

function responseStub() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(method, body = undefined) {
  return {
    method,
    body,
    headers: {
      origin: 'https://pazartarla.example',
      host: 'pazartarla.example',
      'x-forwarded-proto': 'https',
      'content-type': 'application/json',
    },
  };
}

test('Turso submissions are server-owned, pending, quota-counted, and expire after 12 Istanbul calendar months', async () => {
  const { database, sqlite } = fixture();
  const result = await createTursoListing(database, USER_SESSION, payload({
    id: 9876,
    status: 'approved',
    submitted_by: 'forged-user',
    is_featured: true,
    offerRequested: true,
  }), NOW);
  assert.equal(result.listing.id, 1);
  assert.equal(result.listing.status, 'pending');
  assert.equal(result.listing.submitted_by, 'member-a');
  assert.equal(result.listing.is_featured, false);
  assert.deepEqual(result.listing.gallery_paths, ['https://images.example.test/tractor.jpg']);
  assert.equal(result.listing.expires_at, '2027-10-13T12:00:00.000Z');
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM private__depot_contacts').get().count), 1);
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM private__depot_sources').get().count), 1);
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM private__listing_submission_log').get().count), 1);
  assert.equal(Number(sqlite.prepare('SELECT enabled FROM private__listing_offer_settings WHERE listing_id = 1').get().enabled), 1);
  sqlite.close();
});

test('submission expiry follows Istanbul calendar dates and clamps leap day safely', () => {
  assert.equal(
    listingExpiryAfterOneIstanbulYear(new Date('2024-02-29T12:00:00.000Z')),
    '2025-02-28T12:00:00.000Z',
  );
});

test('unverified, invalid-category, data-URI and over-quota submissions are rejected before persistence', async () => {
  const { database, sqlite } = fixture();
  await assert.rejects(
    createTursoListing(database, { ...USER_SESSION, user: { id: 'member-a' } }, payload(), NOW),
    error => error.code === 'LISTING_VERIFIED_ACCOUNT_REQUIRED',
  );
  await assert.rejects(
    createTursoListing(database, USER_SESSION, payload({ subCategory: 'Unknown' }), NOW),
    error => error.code === 'LISTING_CATEGORY_INVALID',
  );
  await assert.rejects(
    createTursoListing(database, USER_SESSION, payload({ images: ['data:image/png;base64,abc'] }), NOW),
    error => error.code === 'LISTING_MEDIA_STORAGE_REQUIRED',
  );
  for (let index = 0; index < 10; index += 1) {
    await createTursoListing(database, USER_SESSION, payload({ title: `Listing ${index}` }), NOW);
  }
  await assert.rejects(
    createTursoListing(database, USER_SESSION, payload(), NOW),
    error => error.code === 'LISTING_DAILY_LIMIT_REACHED' && error.status === 429,
  );
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM listings').get().count), 10);
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM private__listing_submission_log').get().count), 10);
  sqlite.close();
});

test('write API requires an enabled backend and a verified same-origin session', async () => {
  const { database, sqlite } = fixture();
  const handler = createSubmissionWriteHandler({
    connect: () => database,
    mutationsEnabled: true,
    authEnabled: true,
    secretProvider: () => 'x'.repeat(40),
    getSession: async () => USER_SESSION,
    now: () => NOW,
  });
  const denied = responseStub();
  await handler({
    ...request('POST', payload()),
    headers: { ...request('POST').headers, origin: 'https://attacker.example' },
  }, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM listings').get().count), 0);

  const created = responseStub();
  await handler(request('POST', payload()), created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.listing.status, 'pending');
  assert.equal(created.body.listing.submitted_by, 'member-a');
  sqlite.close();
});

test('moderation requires a fresh database-authorized admin session and rejects stale snapshots', async () => {
  const { database, sqlite } = fixture();
  await createTursoListing(database, USER_SESSION, payload(), NOW);
  const queue = await readTursoModerationQueue(database, NOW);
  assert.equal(queue.length, 1);
  await assert.rejects(
    moderateTursoListing(database, { ...ADMIN_SESSION, is_admin: false }, 1, 'approved', queue[0].edit_token, NOW),
    error => error.code === 'LISTING_ADMIN_REAUTH_REQUIRED',
  );
  await assert.rejects(
    moderateTursoListing(database, {
      ...ADMIN_SESSION,
      admin_reauth_at: new Date(NOW.getTime() - 16 * 60 * 1000).toISOString(),
    }, 1, 'approved', queue[0].edit_token, NOW),
    error => error.code === 'LISTING_ADMIN_REAUTH_REQUIRED',
  );
  sqlite.prepare('UPDATE listings SET title = ? WHERE id = 1').run('Changed after review');
  await assert.rejects(
    moderateTursoListing(database, ADMIN_SESSION, 1, 'approved', queue[0].edit_token, NOW),
    error => error.code === 'LISTING_EDIT_CONFLICT',
  );
  const freshQueue = await readTursoModerationQueue(database, NOW);
  const result = await moderateTursoListing(
    database, ADMIN_SESSION, 1, 'approved', freshQueue[0].edit_token, NOW,
  );
  assert.equal(result.listing.status, 'approved');
  assert.equal((await readTursoModerationQueue(database, NOW)).length, 0);
  sqlite.close();
});

test('Turso admin edit snapshot saves only gallery and SEO metadata and rejects stale changes', async () => {
  const { database, sqlite } = fixture();
  const created = await createTursoListing(database, USER_SESSION, payload(), NOW);
  const snapshot = await readTursoAdminListingForEdit(database, ADMIN_SESSION, created.listing.id, NOW);
  assert.equal(snapshot.listing.id, created.listing.id);
  assert.match(snapshot.edit_token, /^[a-f0-9]{64}$/);
  const gallery = [
    'https://photos.example.test/one.webp',
    'https://photos.example.test/two.webp',
  ];
  const updated = await updateTursoListingMedia(database, ADMIN_SESSION, created.listing.id,
    snapshot.edit_token, { image: gallery[0], gallery_paths: gallery, seotags: 'tractor, balikesir' }, NOW);
  assert.deepEqual(updated.listing.gallery_paths, gallery);
  assert.equal(updated.listing.image, gallery[0]);
  assert.equal(updated.listing.seotags, 'tractor, balikesir');
  assert.equal(updated.listing.status, 'pending');
  assert.equal(Number(sqlite.prepare('SELECT COUNT(*) AS count FROM listings').get().count), 1);
  await assert.rejects(
    updateTursoListingMedia(database, ADMIN_SESSION, created.listing.id, snapshot.edit_token,
      { image: gallery[0], gallery_paths: gallery, seotags: 'changed' }, NOW),
    error => error.code === 'LISTING_EDIT_CONFLICT' && error.status === 409,
  );
  sqlite.close();
});

test('Turso featured placement is an audited admin-only snapshot update', async () => {
  const { database, sqlite } = fixture();
  const created = await createTursoListing(database, USER_SESSION, payload(), NOW);
  const snapshot = await readTursoAdminListingForEdit(database, ADMIN_SESSION, created.listing.id, NOW);
  const saved = await updateTursoListingFeatured(
    database, ADMIN_SESSION, created.listing.id, snapshot.edit_token, true, NOW,
  );
  assert.equal(saved.listing.is_featured, true);
  assert.equal(saved.listing.status, 'pending');
  await assert.rejects(updateTursoListingFeatured(
    database, ADMIN_SESSION, created.listing.id, snapshot.edit_token, false, NOW,
  ), error => error.code === 'LISTING_EDIT_CONFLICT' && error.status === 409);
  assert.equal(Number(sqlite.prepare('SELECT is_featured FROM listings WHERE id = ?').get(created.listing.id).is_featured), 1);
  sqlite.close();
});

test('submission and moderation APIs remain closed until both Turso feature flags are enabled', async () => {
  const { database, sqlite } = fixture();
  const postHandler = createSubmissionWriteHandler({
    connect: () => database,
    mutationsEnabled: false,
    authEnabled: true,
    secretProvider: () => 'x'.repeat(40),
    now: () => NOW,
  });
  const postResponse = responseStub();
  await postHandler(request('POST', payload()), postResponse);
  assert.equal(postResponse.statusCode, 503);

  const moderationHandler = createListingModerationHandler({
    connect: () => database,
    mutationsEnabled: true,
    authEnabled: true,
    secretProvider: () => 'x'.repeat(40),
    getSession: async () => ADMIN_SESSION,
    now: () => NOW,
  });
  const queueResponse = responseStub();
  await moderationHandler(request('GET'), queueResponse);
  assert.equal(queueResponse.statusCode, 200);
  assert.deepEqual(queueResponse.body, []);
  const forbidden = responseStub();
  await moderationHandler({
    ...request('POST', { id: 1 }),
    headers: { ...request('POST').headers, origin: 'https://attacker.example' },
  }, forbidden);
  assert.equal(forbidden.statusCode, 403);
  sqlite.close();
});

test('Turso owners can edit and archive their own listings without replacing protected data', async () => {
  const { database, sqlite } = fixture();
  try {
    const created = await createTursoListing(database, USER_SESSION, payload(), NOW);
    const id = created.listing.id;
    await database.run("UPDATE listings SET status = 'approved' WHERE id = ?", id);
    const original = await readTursoOwnerListingForEdit(database, USER_SESSION, id, NOW);
    const edited = await updateTursoOwnerListingDetails(
      database, USER_SESSION, id, { title: 'Owner correction', price: 175000 }, original.edit_token, NOW,
    );
    assert.equal(edited.listing.title, 'Owner correction');
    assert.equal(edited.listing.price, 175000);
    assert.equal(edited.listing.status, 'pending');
    assert.equal(edited.changed, true);
    assert.equal(edited.reapproval_required, true);
    for (const field of ['id', 'submitted_by', 'created_at', 'expires_at', 'image', 'gallery_paths', 'mode']) {
      assert.deepEqual(edited.listing[field], original.listing[field], `${field} is preserved`);
    }
    await assert.rejects(
      readTursoOwnerListingForEdit(database, OTHER_SESSION, id, NOW),
      error => error.code === 'LISTING_EDIT_FORBIDDEN',
    );
    await assert.rejects(
      updateTursoOwnerListingDetails(database, USER_SESSION, id, { title: 'stale' }, original.edit_token, NOW),
      error => error.code === 'LISTING_EDIT_CONFLICT',
    );
    await assert.rejects(
      updateTursoOwnerListingDetails(database, USER_SESSION, id, { status: 'approved' }, edited.edit_token, NOW),
      error => error.code === 'LISTING_EDIT_INVALID',
    );

    await database.run("UPDATE listings SET status = 'approved' WHERE id = ?", id);
    const beforeArchive = await readTursoOwnerListingForEdit(database, USER_SESSION, id, NOW);
    const archived = await updateTursoOwnerListingArchive(
      database, USER_SESSION, id, beforeArchive.edit_token, 'archive', NOW,
    );
    assert.equal(archived.listing.status, 'archived');
    assert.equal(archived.listing.image, original.listing.image);
    assert.equal(archived.listing.created_at, original.listing.created_at);
    const restored = await updateTursoOwnerListingArchive(
      database, USER_SESSION, id, archived.edit_token, 'restore', NOW,
    );
    assert.equal(restored.listing.status, 'pending');
    assert.equal(restored.listing.image, original.listing.image);
    const persisted = sqlite.prepare('SELECT status, image, created_at, expires_at FROM listings WHERE id = ?').get(id);
    assert.equal(persisted.status, 'pending');
    assert.equal(persisted.image, original.listing.image);
    assert.equal(persisted.created_at, original.listing.created_at);
    assert.equal(persisted.expires_at, original.listing.expires_at);
  } finally {
    sqlite.close();
  }
});

test('Turso owner listing endpoint requires same-origin authenticated access and exposes no cached private snapshots', async () => {
  const { database, sqlite } = fixture();
  try {
    const created = await createTursoListing(database, USER_SESSION, payload(), NOW);
    const handler = createOwnerListingHandler({
      connect: () => database,
      mutationsEnabled: true,
      authEnabled: true,
      secret: 's'.repeat(32),
      getSession: async () => USER_SESSION,
      now: () => NOW,
    });
    const getRequest = request('GET');
    getRequest.query = { id: created.listing.id };
    const readResponse = responseStub();
    await handler(getRequest, readResponse);
    assert.equal(readResponse.statusCode, 200);
    assert.equal(readResponse.headers['Cache-Control'], 'private, no-store');
    assert.equal(readResponse.headers.Vary, 'Cookie');
    assert.equal(readResponse.body.listing.id, created.listing.id);
    assert.match(readResponse.body.edit_token, /^[a-f0-9]{64}$/);

    const crossOrigin = request('POST', { action: 'archive', id: created.listing.id,
      edit_token: readResponse.body.edit_token });
    crossOrigin.headers.origin = 'https://attacker.example';
    const denied = responseStub();
    await handler(crossOrigin, denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(sqlite.prepare('SELECT status FROM listings WHERE id = ?').get(created.listing.id).status, 'pending');
  } finally {
    sqlite.close();
  }
});
