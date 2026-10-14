import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { parseStoreData } from '../src/lib/storeMembership.ts';
import {
  createStoreMembershipDataHandler,
  createStorePublicationHandler,
} from '../server/storeMembershipHandlers.js';
import { createStoreMembershipMutationHandler } from '../server/storeMembershipMutationHandlers.js';
import { mutateTursoStoreMembership } from '../server/tursoStoreMembershipMutations.js';
import { readTursoStoreMembershipData, validStoreId } from '../server/tursoMembershipData.js';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const OWNER = '00000000-0000-4000-8000-000000000001';
const ADMIN_OWNER = '00000000-0000-4000-8000-000000000002';
const REQUEST_ONE = '00000000-0000-4000-8000-000000000021';
const REQUEST_TWO = '00000000-0000-4000-8000-000000000022';
const NEW_OWNER = '00000000-0000-4000-8000-000000000031';
const NEW_REQUEST = '00000000-0000-4000-8000-000000000032';
const TRIAL_OWNER = '00000000-0000-4000-8000-000000000041';
const TRIAL_REQUEST = '00000000-0000-4000-8000-000000000042';
const APPROVAL_OWNER = '00000000-0000-4000-8000-000000000051';
const APPROVAL_REQUEST = '00000000-0000-4000-8000-000000000052';
const REJECT_OWNER = '00000000-0000-4000-8000-000000000061';
const REJECT_REQUEST = '00000000-0000-4000-8000-000000000062';
const PUBLIC_STORE = '00000000-0000-4000-8000-000000000011';
const HIDDEN_STORE = '00000000-0000-4000-8000-000000000012';
const EXPIRED_STORE = '00000000-0000-4000-8000-000000000013';

function createDatabase() {
  const inner = new DatabaseSync(':memory:');
  inner.exec(`
    CREATE TABLE private__store_plans (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, billing_period TEXT NOT NULL,
      trial_days INTEGER, monthly_price_try NUMERIC, annual_price_try NUMERIC,
      monthly_limit INTEGER, active_limit INTEGER
    );
    CREATE TABLE private__member_stores (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, is_public INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE private__store_memberships (
      owner_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, plan_name TEXT NOT NULL,
      billing_period TEXT NOT NULL, trial_days INTEGER, monthly_limit INTEGER,
      active_limit INTEGER, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE private__store_requests (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL, billing_period TEXT NOT NULL, trial_days INTEGER,
      monthly_price_try NUMERIC, annual_price_try NUMERIC, monthly_limit INTEGER,
      active_limit INTEGER, store_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL, created_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
      decided_at TEXT, decided_by TEXT
    );
    CREATE TABLE private__store_trial_ledger (
      owner_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL
    );
    CREATE TABLE private__store_payment_log (
      reference TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, approved_by TEXT NOT NULL,
      amount_try NUMERIC NOT NULL, recorded_at TEXT NOT NULL
    );
    CREATE TABLE app_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, email_confirmed_at TEXT DEFAULT '2026-01-01T00:00:00.000Z',
      is_anonymous INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE listings (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, price NUMERIC NOT NULL,
      category TEXT NOT NULL, "subCategory" TEXT, mode TEXT, location TEXT,
      amount TEXT, description TEXT, seller TEXT NOT NULL, phone TEXT NOT NULL,
      image TEXT, gallery_paths TEXT, is_featured INTEGER, status TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT, submitted_by TEXT
    );
  `);
  const insert = (sql, ...values) => inner.prepare(sql).run(...values);
  for (const plan of [
    ['package-1', 'Paket 1', 'month', null, 350, null, 30, 100],
    ['package-3', 'Paket 3', 'year', null, null, 2500, null, null],
    ['trial-30-days', '30 Gün Ücretsiz Deneme', 'trial', 30, null, null, null, null],
  ]) insert('INSERT INTO private__store_plans VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ...plan);

  insert('INSERT INTO app_users(id, email) VALUES (?, ?)', OWNER, 'member@example.test');
  insert('INSERT INTO app_users(id, email) VALUES (?, ?)', ADMIN_OWNER, 'admin@example.test');
  for (const [id, owner, name, isPublic] of [
    [PUBLIC_STORE, OWNER, 'Açık Mağaza', 1],
    [HIDDEN_STORE, ADMIN_OWNER, 'Gizli Mağaza', 0],
    [EXPIRED_STORE, '00000000-0000-4000-8000-000000000003', 'Süresi Biten Mağaza', 1],
  ]) {
    insert('INSERT INTO private__member_stores VALUES (?, ?, ?, ?, ?, ?)',
      id, owner, name, 'Mağaza açıklaması', 2, isPublic);
    const endsAt = id === EXPIRED_STORE ? '2026-10-12T00:00:00.000Z' : '2026-11-01T00:00:00.000Z';
    insert(`INSERT INTO private__store_memberships
      (owner_id, request_id, plan_name, billing_period, trial_days, monthly_limit, active_limit, starts_at, ends_at, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    owner, `request-${id}`, 'Paket 1', 'month', null, 30, 100,
    '2026-10-01T00:00:00.000Z', endsAt, 1);
  }
  insert(`INSERT INTO private__store_requests
    (id, owner_id, plan_id, plan_name, billing_period, trial_days, monthly_price_try,
     annual_price_try, monthly_limit, active_limit, store_name, status, created_at, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  REQUEST_ONE, OWNER, 'package-1', 'Paket 1', 'month', null, 350, null, 30, 100,
  'Açık Mağaza', 'pending', '2026-10-10T00:00:00.000Z', 1);
  insert(`INSERT INTO private__store_requests
    (id, owner_id, plan_id, plan_name, billing_period, trial_days, monthly_price_try,
     annual_price_try, monthly_limit, active_limit, store_name, status, created_at, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  REQUEST_TWO, ADMIN_OWNER, 'package-1', 'Paket 1', 'month', null, 350, null, 30, 100,
  'Gizli Mağaza', 'approved', '2026-10-11T00:00:00.000Z', 2);
  insert('INSERT INTO private__store_trial_ledger VALUES (?, ?, ?, ?)',
    OWNER, 'trial-request', '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
  insert(`INSERT INTO listings
    (id, title, price, category, "subCategory", mode, location, amount, description, seller, phone,
     image, gallery_paths, is_featured, status, created_at, expires_at, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  1, 'Elma', 120, 'Meyve', 'Elma', 'Satılık', 'Bursa', '1 ton', 'Açıklama', 'Satıcı', '05000000000',
  '/media/1.jpg', '["/media/1.jpg"]', 0, 'approved', '2026-10-10T00:00:00.000Z',
  '2027-06-10T00:00:00.000Z', OWNER);
  return {
    get(sql, ...args) { return inner.prepare(sql).get(...args); },
    all(sql, ...args) { return inner.prepare(sql).all(...args); },
    run(sql, ...args) { return inner.prepare(sql).run(...args); },
    transactionAsync(callback) {
      const immediate = async () => {
        inner.exec('BEGIN IMMEDIATE');
        const transaction = {
          get(sql, ...args) { return inner.prepare(sql).get(...args); },
          all(sql, ...args) { return inner.prepare(sql).all(...args); },
          run(sql, ...args) { return inner.prepare(sql).run(...args); },
        };
        try {
          const result = await callback(transaction);
          inner.exec('COMMIT');
          return result;
        } catch (error) {
          inner.exec('ROLLBACK');
          throw error;
        }
      };
      immediate.immediate = immediate;
      return immediate;
    },
    close() { inner.close(); },
  };
}

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function postRequest(body, origin = 'https://pazartarla.example') {
  return {
    method: 'POST',
    url: '/api/store-membership/publication',
    headers: {
      origin,
      host: 'pazartarla.example',
      'x-forwarded-proto': 'https',
    },
    body,
  };
}

function seedUser(database, id, email = `${id.slice(-4)}@example.test`) {
  database.run('INSERT INTO app_users(id, email) VALUES(?, ?)', id, email);
}

function seedPendingRequest(database, {
  id,
  ownerId,
  planId = 'package-1',
  planName = 'Paket 1',
  billingPeriod = 'month',
  monthlyPrice = 350,
  annualPrice = null,
  monthlyLimit = 30,
  activeLimit = 100,
  storeName = 'Yeni Mağaza',
  description = 'Deneme açıklaması',
  revision = 1,
} = {}) {
  database.run(
    `INSERT INTO private__store_requests(
       id, owner_id, plan_id, plan_name, billing_period, trial_days,
       monthly_price_try, annual_price_try, monthly_limit, active_limit,
       store_name, description, status, created_at, revision
     ) VALUES(?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    id,
    ownerId,
    planId,
    planName,
    billingPeriod,
    monthlyPrice,
    annualPrice,
    monthlyLimit,
    activeLimit,
    storeName,
    description,
    NOW.toISOString(),
    revision,
  );
}

test('public store data hides unpublished and expired stores and exposes only approved live listings', async () => {
  const database = createDatabase();
  try {
    const data = await readTursoStoreMembershipData(database, { now: NOW });
    assert.deepEqual(data.stores.map(store => store.id), [PUBLIC_STORE]);
    assert.deepEqual(data.stores[0].listing_ids, [1]);
    assert.equal(data.mine, null);
    assert.deepEqual(data.requests, []);
    assert.deepEqual(data.admin_stores, []);
    assert.equal(data.stores[0].owner_id, undefined);

    const hidden = await readTursoStoreMembershipData(database, { storeId: HIDDEN_STORE, now: NOW });
    assert.equal(hidden.store, null);
    assert.deepEqual(hidden.listings, []);
    parseStoreData(data);
  } finally {
    database.close();
  }
});

test('member sees only their own requests, store, membership and one-use trial state', async () => {
  const database = createDatabase();
  try {
    const data = await readTursoStoreMembershipData(database, {
      session: { user: { id: OWNER }, is_admin: false },
      now: NOW,
    });
    assert.equal(data.mine.store.id, PUBLIC_STORE);
    assert.equal(data.mine.membership.plan_name, 'Paket 1');
    assert.deepEqual(data.mine.requests.map(request => request.id), [REQUEST_ONE]);
    assert.equal(data.mine.trial_used, true);
    assert.deepEqual(data.requests, []);
    assert.deepEqual(data.admin_stores, []);
    parseStoreData(data);
  } finally {
    database.close();
  }
});

test('verified database admin can see all membership requests and unpublished active stores', async () => {
  const database = createDatabase();
  try {
    const data = await readTursoStoreMembershipData(database, {
      session: { user: { id: ADMIN_OWNER }, is_admin: true },
      now: NOW,
    });
    assert.deepEqual(data.requests.map(request => request.id), [REQUEST_TWO, REQUEST_ONE]);
    assert.equal(data.requests[0].email, 'admin@example.test');
    assert.equal(data.requests[0].owner_id, undefined);
    assert.deepEqual(data.admin_stores.map(store => store.id), [PUBLIC_STORE, HIDDEN_STORE]);
    assert.equal(data.admin_stores[1].is_public, false);
    assert.equal(data.admin_stores[1].membership_ends_at, '2026-11-01T00:00:00.000Z');
    parseStoreData(data);
  } finally {
    database.close();
  }
});

test('membership API handles anonymous public requests and rejects invalid store ids', async () => {
  const database = createDatabase();
  try {
    const endpoint = createStoreMembershipDataHandler({
      connect: () => database,
      authEnabled: false,
      now: () => NOW,
    });
    const ok = responseMock();
    await endpoint({ method: 'GET', url: '/api/store-membership-data' }, ok);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.headers['Cache-Control'], 'private, no-store');
    assert.equal(ok.body.mine, null);

    const invalid = responseMock();
    await endpoint({ method: 'GET', url: '/api/store-membership-data?store_id=bad' }, invalid);
    assert.equal(invalid.statusCode, 400);

    const method = responseMock();
    await endpoint({ method: 'POST', url: '/api/store-membership-data' }, method);
    assert.equal(method.statusCode, 405);
  } finally {
    database.close();
  }
});

test('store publication changes require fresh verified admin auth and an active membership', async () => {
  const database = createDatabase();
  try {
    const admin = createStorePublicationHandler({
      connect: () => database,
      authEnabled: true,
      secret: 'synthetic-store-admin-session-secret-32-bytes',
      getSession: async () => ({ is_admin: true, admin_reauth_at: NOW.toISOString() }),
      now: () => NOW,
    });
    const publish = responseMock();
    await admin(postRequest({
      p_id: HIDDEN_STORE,
      p_revision: 2,
      p_is_public: true,
    }), publish);
    assert.equal(publish.statusCode, 200);
    assert.deepEqual(publish.body, { ok: true, is_public: true, revision: 3 });
    assert.equal(database.get('SELECT is_public FROM private__member_stores WHERE id = ?', HIDDEN_STORE).is_public, 1);

    const idempotent = responseMock();
    await admin(postRequest({
      p_id: HIDDEN_STORE,
      p_revision: 3,
      p_is_public: true,
    }), idempotent);
    assert.deepEqual(idempotent.body, { ok: true, is_public: true, revision: 3 });

    const stale = responseMock();
    await admin(postRequest({
      p_id: HIDDEN_STORE,
      p_revision: 2,
      p_is_public: false,
    }), stale);
    assert.equal(stale.statusCode, 409);

    const expired = responseMock();
    await admin(postRequest({
      p_id: EXPIRED_STORE,
      p_revision: 2,
      p_is_public: false,
    }), expired);
    assert.equal(expired.statusCode, 409);
  } finally {
    database.close();
  }
});

test('store publication rejects members, stale admin reauthentication and cross-origin requests', async () => {
  const database = createDatabase();
  try {
    const makeAdmin = session => createStorePublicationHandler({
      connect: () => database,
      authEnabled: true,
      secret: 'synthetic-store-admin-session-secret-32-bytes',
      getSession: async () => session,
      now: () => NOW,
    });
    const payload = { p_id: HIDDEN_STORE, p_revision: 2, p_is_public: true };

    const member = responseMock();
    await makeAdmin({ is_admin: false, admin_reauth_at: NOW.toISOString() })(
      postRequest(payload), member,
    );
    assert.equal(member.statusCode, 403);

    const staleAdmin = responseMock();
    await makeAdmin({
      is_admin: true,
      admin_reauth_at: new Date(NOW.getTime() - 16 * 60 * 1000).toISOString(),
    })(postRequest(payload), staleAdmin);
    assert.equal(staleAdmin.statusCode, 403);

    const crossOrigin = responseMock();
    await makeAdmin({ is_admin: true, admin_reauth_at: NOW.toISOString() })(
      postRequest(payload, 'https://attacker.test'), crossOrigin,
    );
    assert.equal(crossOrigin.statusCode, 403);
    assert.equal(database.get('SELECT is_public FROM private__member_stores WHERE id = ?', HIDDEN_STORE).is_public, 0);
  } finally {
    database.close();
  }
});

test('member store requests are idempotent, revision-safe and reject direct trial routing', async () => {
  const database = createDatabase();
  try {
    seedUser(database, NEW_OWNER);
    const args = {
      userId: NEW_OWNER,
      action: 'request',
      id: NEW_REQUEST,
      payload: { plan_id: 'package-1', store_name: 'Yeni Mağaza', description: 'Açıklama' },
      now: NOW,
    };
    assert.deepEqual(await mutateTursoStoreMembership(database, args), { ok: true, id: NEW_REQUEST });
    assert.deepEqual(await mutateTursoStoreMembership(database, args), { ok: true, id: NEW_REQUEST });
    assert.equal(database.get('SELECT status FROM private__store_requests WHERE id = ?', NEW_REQUEST).status, 'pending');

    await assert.rejects(
      mutateTursoStoreMembership(database, {
        ...args,
        id: '00000000-0000-4000-8000-000000000033',
      }),
      error => error.code === 'MEMBERSHIP_PENDING',
    );
    await assert.rejects(
      mutateTursoStoreMembership(database, {
        ...args,
        id: '00000000-0000-4000-8000-000000000034',
        payload: { plan_id: 'trial-30-days', store_name: 'Yeni Mağaza', description: '' },
      }),
      error => error.code === 'MEMBERSHIP_TRIAL_DIRECT_ONLY',
    );
  } finally {
    database.close();
  }
});

test('members can update their active store profile with revision protection', async () => {
  const database = createDatabase();
  try {
    const result = await mutateTursoStoreMembership(database, {
      userId: OWNER,
      action: 'store',
      revision: 2,
      payload: { store_name: 'Güncel Mağaza', description: 'Yeni açıklama' },
      now: NOW,
    });
    assert.equal(result.ok, true);
    assert.equal(result.revision, 3);
    const store = database.get('SELECT name, description FROM private__member_stores WHERE owner_id = ?', OWNER);
    assert.equal(store.name, 'Güncel Mağaza');
    assert.equal(store.description, 'Yeni açıklama');
    await assert.rejects(
      mutateTursoStoreMembership(database, {
        userId: OWNER,
        action: 'store',
        revision: 2,
        payload: { store_name: 'Stale Mağaza', description: '' },
        now: NOW,
      }),
      error => error.code === 'MEMBERSHIP_STALE',
    );
  } finally {
    database.close();
  }
});

test('30-day store trial is atomic, idempotent only for its matching request, and single-use', async () => {
  const database = createDatabase();
  try {
    seedUser(database, TRIAL_OWNER);
    const args = {
      userId: TRIAL_OWNER,
      action: 'trial_start',
      id: TRIAL_REQUEST,
      revision: null,
      payload: { plan_id: 'trial-30-days', store_name: 'Deneme Mağazası', description: 'İlk açıklama' },
      now: NOW,
    };
    const started = await mutateTursoStoreMembership(database, args);
    assert.equal(started.ok, true);
    assert.equal(Date.parse(started.ends_at) - NOW.getTime(), 30 * 24 * 60 * 60 * 1000);
    assert.equal(database.get('SELECT billing_period FROM private__store_memberships WHERE owner_id = ?', TRIAL_OWNER).billing_period, 'trial');
    assert.deepEqual(await mutateTursoStoreMembership(database, args), started);
    await assert.rejects(
      mutateTursoStoreMembership(database, {
        ...args,
        id: '00000000-0000-4000-8000-000000000043',
      }),
      error => error.code === 'MEMBERSHIP_TRIAL_USED',
    );
    assert.equal(database.get('SELECT COUNT(*) AS count FROM private__store_requests WHERE owner_id = ?', TRIAL_OWNER).count, 1);
  } finally {
    database.close();
  }
});

test('admin store approval records one payment and creates the annual unlimited membership atomically', async () => {
  const database = createDatabase();
  try {
    seedUser(database, APPROVAL_OWNER);
    seedPendingRequest(database, {
      id: APPROVAL_REQUEST,
      ownerId: APPROVAL_OWNER,
      planId: 'package-3',
      planName: 'Paket 3',
      billingPeriod: 'year',
      monthlyPrice: null,
      annualPrice: 2500,
      monthlyLimit: null,
      activeLimit: null,
    });
    const args = {
      userId: ADMIN_OWNER,
      action: 'approve',
      id: APPROVAL_REQUEST,
      revision: 1,
      payload: { payment_confirmed: true, payment_reference: ' EFT-2026-0001 ' },
      now: NOW,
    };
    assert.deepEqual(await mutateTursoStoreMembership(database, args), { ok: true, id: APPROVAL_REQUEST });
    assert.deepEqual(await mutateTursoStoreMembership(database, args), { ok: true, id: APPROVAL_REQUEST });
    const membership = database.get('SELECT billing_period, monthly_limit, active_limit, ends_at FROM private__store_memberships WHERE owner_id = ?', APPROVAL_OWNER);
    assert.equal(membership.billing_period, 'year');
    assert.equal(membership.monthly_limit, null);
    assert.equal(membership.active_limit, null);
    assert.equal(membership.ends_at, '2027-10-13T12:00:00.000Z');
    const payment = database.get('SELECT reference, amount_try FROM private__store_payment_log WHERE request_id = ?', APPROVAL_REQUEST);
    assert.equal(payment.reference, 'EFT-2026-0001');
    assert.equal(payment.amount_try, 2500);
    assert.equal(database.get('SELECT status FROM private__store_requests WHERE id = ?', APPROVAL_REQUEST).status, 'approved');
  } finally {
    database.close();
  }
});

test('rejection is revision-checked and cannot accidentally approve trial requests', async () => {
  const database = createDatabase();
  try {
    seedUser(database, REJECT_OWNER);
    seedPendingRequest(database, { id: REJECT_REQUEST, ownerId: REJECT_OWNER });
    const rejected = await mutateTursoStoreMembership(database, {
      userId: ADMIN_OWNER,
      action: 'reject',
      id: REJECT_REQUEST,
      revision: 1,
      payload: {},
      now: NOW,
    });
    assert.deepEqual(rejected, { ok: true, id: REJECT_REQUEST });
    assert.equal(database.get('SELECT status, revision FROM private__store_requests WHERE id = ?', REJECT_REQUEST).revision, 2);
    await assert.rejects(
      mutateTursoStoreMembership(database, {
        userId: ADMIN_OWNER,
        action: 'reject',
        id: REJECT_REQUEST,
        revision: 1,
        payload: {},
        now: NOW,
      }),
      error => error.code === 'MEMBERSHIP_STALE',
    );
  } finally {
    database.close();
  }
});

test('membership mutation API stays closed by default and requires verified same-origin sessions', async () => {
  const database = createDatabase();
  try {
    seedUser(database, NEW_OWNER);
    const body = {
      p_action: 'request',
      p_id: NEW_REQUEST,
      p_payload: { plan_id: 'package-1', store_name: 'Yeni Mağaza', description: '' },
    };
    const disabled = responseMock();
    await createStoreMembershipMutationHandler({
      connect: () => database,
      authEnabled: false,
    })(postRequest(body), disabled);
    assert.equal(disabled.statusCode, 503);
    assert.equal(database.get('SELECT COUNT(*) AS count FROM private__store_requests WHERE id = ?', NEW_REQUEST).count, 0);

    const memberHandler = createStoreMembershipMutationHandler({
      connect: () => database,
      authEnabled: true,
      secret: 'synthetic-store-admin-session-secret-32-bytes',
      getSession: async () => ({ user: { id: NEW_OWNER }, is_admin: false }),
      now: () => NOW,
    });
    const ok = responseMock();
    await memberHandler(postRequest(body), ok);
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.body, { ok: true, id: NEW_REQUEST });

    const attacker = responseMock();
    await memberHandler(postRequest({
      ...body,
      p_id: '00000000-0000-4000-8000-000000000033',
    }, 'https://attacker.example'), attacker);
    assert.equal(attacker.statusCode, 403);
    assert.equal(database.get('SELECT COUNT(*) AS count FROM private__store_requests WHERE owner_id = ?', NEW_OWNER).count, 1);

    seedPendingRequest(database, {
      id: APPROVAL_REQUEST,
      ownerId: APPROVAL_OWNER,
      planId: 'package-3',
      planName: 'Paket 3',
      billingPeriod: 'year',
      monthlyPrice: null,
      annualPrice: 2500,
      monthlyLimit: null,
      activeLimit: null,
    });
    const adminWithoutReauth = createStoreMembershipMutationHandler({
      connect: () => database,
      authEnabled: true,
      secret: 'synthetic-store-admin-session-secret-32-bytes',
      getSession: async () => ({
        user: { id: ADMIN_OWNER },
        is_admin: true,
        admin_reauth_at: new Date(NOW.getTime() - 16 * 60 * 1000).toISOString(),
      }),
      now: () => NOW,
    });
    const notReauthenticated = responseMock();
    await adminWithoutReauth(postRequest({
      p_action: 'approve',
      p_id: APPROVAL_REQUEST,
      p_revision: 1,
      p_payload: { payment_confirmed: true, payment_reference: 'EFT-ADMIN-1' },
    }), notReauthenticated);
    assert.equal(notReauthenticated.statusCode, 403);
    assert.equal(database.get('SELECT status FROM private__store_requests WHERE id = ?', APPROVAL_REQUEST).status, 'pending');
  } finally {
    database.close();
  }
});

test('store ids must be canonical UUIDs', () => {
  assert.equal(validStoreId(PUBLIC_STORE), true);
  for (const id of ['', '1', '00000000-0000-4000-8000-00000000001Z', null, 42]) {
    assert.equal(validStoreId(id), false);
  }
});
