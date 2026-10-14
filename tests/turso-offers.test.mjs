import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createOfferHandler } from '../server/offerHandlers.js';
import { mutateTursoOffer, readTursoOfferData } from '../server/tursoOffers.js';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const SELLER = '00000000-0000-4000-8000-000000000001';
const BUYER = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';

function createDatabase() {
  const inner = new DatabaseSync(':memory:');
  inner.exec(`
    CREATE TABLE listings (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL,
      submitted_by TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE private__listing_offer_settings (
      listing_id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE private__listing_offers (
      id TEXT PRIMARY KEY,
      listing_id INTEGER NOT NULL,
      title_snapshot TEXT NOT NULL,
      seller_phone_snapshot TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      counter_amount NUMERIC,
      quantity TEXT NOT NULL,
      note TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE private__listing_offer_messages (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const database = {
    get(sql, ...values) { return inner.prepare(sql).get(...values); },
    all(sql, ...values) { return inner.prepare(sql).all(...values); },
    run(sql, ...values) {
      const result = inner.prepare(sql).run(...values);
      return { rowsAffected: Number(result.changes) };
    },
    transactionAsync(callback) {
      const immediate = async () => {
        inner.exec('BEGIN IMMEDIATE');
        const transaction = {
          get(sql, ...values) { return inner.prepare(sql).get(...values); },
          all(sql, ...values) { return inner.prepare(sql).all(...values); },
          run(sql, ...values) {
            const result = inner.prepare(sql).run(...values);
            return { rowsAffected: Number(result.changes) };
          },
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
  inner.prepare(`INSERT INTO listings
    (id, title, phone, status, submitted_by, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    1, 'Aktif ürün', '05321234567', 'approved', SELLER,
    '2027-10-13T12:00:00.000Z', '2026-10-10T00:00:00.000Z',
  );
  inner.prepare(`INSERT INTO listings
    (id, title, phone, status, submitted_by, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    2, 'Süresi dolmuş', '05329876543', 'approved', SELLER,
    '2026-10-13T11:59:59.999Z', '2025-10-10T00:00:00.000Z',
  );
  inner.prepare(`INSERT INTO listings
    (id, title, phone, status, submitted_by, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    3, 'Onay bekliyor', '05321111111', 'pending', OTHER,
    '2027-10-13T12:00:00.000Z', '2026-10-11T00:00:00.000Z',
  );
  inner.prepare(`INSERT INTO private__listing_offer_settings(listing_id, enabled, updated_at)
    VALUES (1, 1, ?), (2, 1, ?), (3, 1, ?)`).run(NOW.toISOString(), NOW.toISOString(), NOW.toISOString());
  return database;
}

function insertOffer(database, {
  id = '00000000-0000-4000-8000-000000000011',
  listingId = 1,
  sellerId = SELLER,
  buyerId = BUYER,
  status = 'pending',
  createdAt = NOW.toISOString(),
} = {}) {
  return database.run(`INSERT INTO private__listing_offers(
    id, listing_id, title_snapshot, seller_phone_snapshot, seller_id, buyer_id,
    amount, counter_amount, quantity, note, buyer_phone, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 500, NULL, '1 ton', 'İlk mesaj', '+905321234567', ?, ?, ?)`,
  id, listingId, 'Ürün anlık görüntüsü', '+905321234567', sellerId, buyerId,
  status, createdAt, createdAt);
}

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('public catalog and private offer data are strictly scoped to active listings and participants', async () => {
  const db = createDatabase();
  try {
    const acceptedId = '00000000-0000-4000-8000-000000000012';
    insertOffer(db, { status: 'accepted', id: acceptedId });
    insertOffer(db, { status: 'pending' });
    db.run(`INSERT INTO private__listing_offer_messages
      (id, offer_id, actor_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    '00000000-0000-4000-8000-000000000021', acceptedId, BUYER, 'Anlaştık', NOW.toISOString());
    db.run(`INSERT INTO private__listing_offer_messages
      (id, offer_id, actor_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    '00000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000011', BUYER, 'Kapalı konuşma', NOW.toISOString());

    const publicData = await readTursoOfferData(db, { now: NOW });
    assert.deepEqual(publicData.catalog_ids, [1]);
    assert.deepEqual(publicData.offers, []);
    assert.deepEqual(publicData.messages, []);

    const buyerData = await readTursoOfferData(db, { userId: BUYER, now: NOW });
    assert.deepEqual(buyerData.catalog_ids, [1]);
    assert.deepEqual(buyerData.owner_ids, []);
    assert.equal(buyerData.offers.length, 2);
    assert.ok(buyerData.offers.every(offer => offer.role === 'buyer'));
    const pending = buyerData.offers.find(offer => offer.status === 'pending');
    assert.equal(pending.buyer_phone, null);
    assert.equal(pending.seller_phone, null);
    const accepted = buyerData.offers.find(offer => offer.status === 'accepted');
    assert.equal(accepted.buyer_phone, '+905321234567');
    assert.equal(accepted.seller_phone, '+905321234567');
    assert.deepEqual(buyerData.messages.map(message => message.body), ['Anlaştık']);

    const sellerData = await readTursoOfferData(db, { userId: SELLER, now: NOW });
    assert.deepEqual(sellerData.owner_ids, [1]);
    assert.deepEqual(sellerData.settings, [{ listing_id: 1, enabled: true }]);
    assert.ok(sellerData.offers.every(offer => offer.role === 'seller'));
    assert.deepEqual((await readTursoOfferData(db, { userId: OTHER, now: NOW })).offers, []);
  } finally {
    db.close();
  }
});

test('offer settings and submissions enforce ownership, listing state, validation and one open offer', async () => {
  const db = createDatabase();
  try {
    await mutateTursoOffer(db, SELLER, {
      action: 'set_listing_offer_enabled',
      p_listing_id: 1,
      p_enabled: false,
    }, NOW);
    assert.equal((await readTursoOfferData(db, { now: NOW })).catalog_ids.length, 0);
    await db.run('UPDATE listings SET status = ? WHERE id = ?', 'pending', 1);
    await mutateTursoOffer(db, SELLER, {
      action: 'set_listing_offer_enabled',
      p_listing_id: 1,
      p_enabled: true,
    }, NOW);
    assert.equal((await readTursoOfferData(db, { now: NOW })).catalog_ids.length, 0);
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'create_listing_offer', p_listing_id: 1, p_amount: 500,
        p_quantity: '1 ton', p_note: '', p_buyer_phone: '05321234567',
      }, NOW),
      error => error.code === 'OFFER_NOT_AVAILABLE',
    );
    await db.run('UPDATE listings SET status = ? WHERE id = ?', 'approved', 1);
    await mutateTursoOffer(db, SELLER, {
      action: 'set_listing_offer_enabled',
      p_listing_id: 1,
      p_enabled: true,
    }, NOW);
    await assert.rejects(
      mutateTursoOffer(db, OTHER, {
        action: 'set_listing_offer_enabled', p_listing_id: 1, p_enabled: false,
      }, NOW),
      error => error.code === 'OFFER_NOT_OWNER',
    );
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'create_listing_offer', p_listing_id: 1, p_amount: 0,
        p_quantity: '1 ton', p_note: '', p_buyer_phone: '05321234567',
      }, NOW),
      error => error.code === 'OFFER_INVALID',
    );
    await assert.rejects(
      mutateTursoOffer(db, SELLER, {
        action: 'create_listing_offer', p_listing_id: 1, p_amount: 500,
        p_quantity: '1 ton', p_note: '', p_buyer_phone: '05321234567',
      }, NOW),
      error => error.code === 'OFFER_NOT_OWNER',
    );
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'create_listing_offer', p_listing_id: 2, p_amount: 500,
        p_quantity: '1 ton', p_note: '', p_buyer_phone: '05321234567',
      }, NOW),
      error => error.code === 'OFFER_NOT_AVAILABLE',
    );

    await mutateTursoOffer(db, BUYER, {
      action: 'create_listing_offer', p_listing_id: 1, p_amount: 500,
      p_quantity: '1 ton', p_note: 'Teklif', p_buyer_phone: '05321234567',
    }, NOW);
    const first = (await readTursoOfferData(db, { userId: BUYER, now: NOW })).offers[0];
    assert.equal(first.buyer_phone, null);
    assert.equal(first.amount, 500);
    assert.equal(first.status, 'pending');
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'create_listing_offer', p_listing_id: 1, p_amount: 600,
        p_quantity: '1 ton', p_note: '', p_buyer_phone: '05321234567',
      }, NOW),
      error => error.code === 'OFFER_CONFLICT',
    );
  } finally {
    db.close();
  }
});

test('seller counteroffer, buyer acceptance and accepted-only messages preserve contact privacy', async () => {
  const db = createDatabase();
  try {
    insertOffer(db);
    const offerId = '00000000-0000-4000-8000-000000000011';
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'respond_to_listing_offer', p_offer_id: offerId,
        p_action: 'accept',
      }, NOW),
      error => error.code === 'OFFER_NOT_OWNER',
    );
    await mutateTursoOffer(db, SELLER, {
      action: 'respond_to_listing_offer', p_offer_id: offerId,
      p_action: 'counter', p_amount: 700,
    }, NOW);
    const buyerCounter = (await readTursoOfferData(db, { userId: BUYER, now: NOW })).offers[0];
    assert.equal(buyerCounter.status, 'countered');
    assert.equal(buyerCounter.counter_amount, 700);
    assert.equal(buyerCounter.buyer_phone, null);
    assert.equal(buyerCounter.seller_phone, null);
    await assert.rejects(
      mutateTursoOffer(db, BUYER, {
        action: 'send_listing_offer_message', p_offer_id: offerId, p_body: 'Merhaba',
      }, NOW),
      error => error.code === 'OFFER_CONFLICT',
    );
    await mutateTursoOffer(db, BUYER, {
      action: 'respond_to_listing_offer', p_offer_id: offerId,
      p_action: 'buyer_accept',
    }, NOW);
    const accepted = (await readTursoOfferData(db, { userId: BUYER, now: NOW })).offers[0];
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.amount, 700);
    assert.equal(accepted.buyer_phone, '+905321234567');
    assert.equal(accepted.seller_phone, '+905321234567');
    await mutateTursoOffer(db, BUYER, {
      action: 'send_listing_offer_message', p_offer_id: offerId, p_body: 'Merhaba',
    }, NOW);
    const sellerData = await readTursoOfferData(db, { userId: SELLER, now: NOW });
    assert.equal(sellerData.messages.length, 1);
    assert.equal(sellerData.messages[0].actor, 'buyer');
    assert.equal(sellerData.messages[0].body, 'Merhaba');
  } finally {
    db.close();
  }
});

test('offer API keeps writes closed without Turso auth and requires same-origin verified sessions', async () => {
  const db = createDatabase();
  try {
    const handler = createOfferHandler({
      connect: () => db,
      authEnabled: true,
      secret: 'x'.repeat(40),
      getSession: async () => ({ user: { id: BUYER, email_confirmed_at: NOW.toISOString() } }),
      now: () => NOW,
    });
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: {
        origin: 'https://pazartarla.example',
        host: 'pazartarla.example',
        'x-forwarded-host': 'pazartarla.example',
        'x-forwarded-proto': 'https',
      },
      body: {
        action: 'create_listing_offer',
        p_listing_id: 1,
        p_amount: 500,
        p_quantity: '1 ton',
        p_note: '',
        p_buyer_phone: '05321234567',
      },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);

    const forbidden = responseMock();
    await handler({
      method: 'POST',
      headers: { origin: 'https://attacker.example', host: 'pazartarla.example' },
      body: { action: 'set_listing_offer_enabled', p_listing_id: 1, p_enabled: false },
    }, forbidden);
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.error, 'origin_not_allowed');

    const disabled = createOfferHandler({ connect: () => db, authEnabled: false });
    const rejected = responseMock();
    await disabled({ method: 'POST', headers: {
      origin: 'https://pazartarla.example',
      host: 'pazartarla.example',
      'x-forwarded-host': 'pazartarla.example',
      'x-forwarded-proto': 'https',
    }, body: { action: 'set_listing_offer_enabled', p_listing_id: 1, p_enabled: false } }, rejected);
    assert.equal(rejected.statusCode, 503);
    assert.equal(rejected.body.error, 'auth_unavailable');
  } finally {
    db.close();
  }
});
