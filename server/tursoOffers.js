import { randomUUID } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OPEN_OFFERS_PER_LISTING = 1;
const MAX_BUYER_OFFERS_PER_DAY = 10;
const MAX_MESSAGES_PER_PARTY_PER_OFFER_PER_DAY = 50;

export class TursoOfferError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.name = 'TursoOfferError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new TursoOfferError(code, status);
}

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validAmount(value) {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.0001
    ? amount
    : null;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength + 1) : '';
}

function normalizePhone(value) {
  if (typeof value !== 'string' || !/^[+0-9 ()-]+$/.test(value)) return null;
  let phone = value.replace(/[ ()-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^0[1-9]\d{9}$/.test(phone)) phone = `+90${phone.slice(1)}`;
  else if (/^[1-9]\d{9}$/.test(phone)) phone = `+90${phone}`;
  else if (/^90[1-9]\d{9}$/.test(phone)) phone = `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

async function withImmediateTransaction(database, callback) {
  if (typeof database?.transactionAsync !== 'function') {
    throw new Error('Turso transaction support is required for offer writes.');
  }
  const transaction = database.transactionAsync(callback);
  if (typeof transaction?.immediate !== 'function') {
    throw new Error('Turso immediate transactions are unavailable.');
  }
  return transaction.immediate();
}

function emptyPrivateOfferData() {
  return { owner_ids: [], settings: [], offers: [], messages: [] };
}

function presentOffer(row, userId) {
  const accepted = row.status === 'accepted';
  return {
    id: row.id,
    listing_id: Number(row.listing_id),
    title: row.title_snapshot,
    role: row.buyer_id === userId ? 'buyer' : 'seller',
    status: row.status,
    amount: Number(row.amount),
    counter_amount: row.counter_amount == null ? null : Number(row.counter_amount),
    quantity: row.quantity,
    note: row.note,
    buyer_phone: accepted ? row.buyer_phone : null,
    seller_phone: accepted ? row.seller_phone_snapshot : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function readTursoOfferData(database, {
  userId = null,
  now = new Date(),
} = {}) {
  const nowIso = now.toISOString();
  const catalogRows = await database.all(
    `SELECT l.id
       FROM listings l
       JOIN private__listing_offer_settings s ON s.listing_id = l.id
      WHERE l.status = 'approved'
        AND l.expires_at IS NOT NULL
        AND l.expires_at > ?
        AND s.enabled = 1
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 1000`,
    nowIso,
  );
  if (!Array.isArray(catalogRows)) throw new Error('INVALID_OFFER_CATALOG');
  const catalogIds = catalogRows.map(row => Number(row.id))
    .filter(id => Number.isSafeInteger(id) && id > 0);

  if (!userId) return { catalog_ids: catalogIds, ...emptyPrivateOfferData() };

  const ownerRows = await database.all(
    `SELECT id FROM listings
      WHERE submitted_by = ?
        AND status = 'approved'
        AND expires_at IS NOT NULL
        AND expires_at > ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1000`,
    userId,
    nowIso,
  );
  const ownerIds = ownerRows.map(row => Number(row.id))
    .filter(id => Number.isSafeInteger(id) && id > 0);
  const settingsRows = ownerIds.length
    ? await database.all(
      `SELECT listing_id, enabled
         FROM private__listing_offer_settings
        WHERE listing_id IN (${ownerIds.map(() => '?').join(', ')})`,
      ...ownerIds,
    )
    : [];
  const offerRows = await database.all(
    `SELECT id, listing_id, title_snapshot, seller_phone_snapshot, seller_id,
            buyer_id, amount, counter_amount, quantity, note, buyer_phone,
            status, created_at, updated_at
       FROM private__listing_offers
      WHERE buyer_id = ? OR seller_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 200`,
    userId,
    userId,
  );
  if (!Array.isArray(offerRows)) throw new Error('INVALID_PRIVATE_OFFERS');
  const acceptedOfferIds = offerRows
    .filter(row => row.status === 'accepted')
    .map(row => row.id);
  const messageRows = acceptedOfferIds.length
    ? await database.all(
      `SELECT m.id, m.offer_id, m.actor_id, m.body, m.created_at
         FROM private__listing_offer_messages m
         JOIN private__listing_offers o ON o.id = m.offer_id
        WHERE o.status = 'accepted'
          AND (o.buyer_id = ? OR o.seller_id = ?)
        ORDER BY m.created_at ASC, m.id ASC
        LIMIT 1000`,
      userId,
      userId,
    )
    : [];

  return {
    catalog_ids: catalogIds,
    owner_ids: ownerIds,
    settings: settingsRows.map(row => ({
      listing_id: Number(row.listing_id),
      enabled: Number(row.enabled) === 1,
    })),
    offers: offerRows.map(row => presentOffer(row, userId)),
    messages: messageRows.map(row => {
      const offer = offerRows.find(item => item.id === row.offer_id);
      return {
        id: row.id,
        offer_id: row.offer_id,
        actor: offer?.buyer_id === row.actor_id ? 'buyer' : 'seller',
        body: row.body,
        created_at: row.created_at,
      };
    }),
  };
}

async function updateOfferSetting(database, userId, listingId, enabled, now) {
  if (!validId(listingId) || typeof enabled !== 'boolean') fail('OFFER_INVALID', 400);
  await withImmediateTransaction(database, async tx => {
    const listing = await tx.get(
      `SELECT id, status, expires_at
         FROM listings
        WHERE id = ? AND submitted_by = ?
        LIMIT 1`,
      Number(listingId),
      userId,
    );
    if (!listing) fail('OFFER_NOT_OWNER', 403);
    // Members may express an offer preference while their new listing is pending.
    // Public catalogs and offer creation still expose only approved, unexpired rows.
    if (enabled && (!['pending', 'approved'].includes(listing.status) ||
        !listing.expires_at || Date.parse(listing.expires_at) <= now.getTime())) {
      fail('OFFER_NOT_AVAILABLE', 409);
    }
    await tx.run(
      `INSERT INTO private__listing_offer_settings(listing_id, enabled, updated_at)
       VALUES(?, ?, ?)
       ON CONFLICT(listing_id) DO UPDATE SET
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`,
      Number(listingId),
      enabled ? 1 : 0,
      now.toISOString(),
    );
  });
}

async function createOffer(database, userId, payload, now) {
  const listingId = payload?.p_listing_id;
  const amount = validAmount(payload?.p_amount);
  const quantity = cleanText(payload?.p_quantity, 120);
  const note = cleanText(payload?.p_note, 500);
  const buyerPhone = normalizePhone(payload?.p_buyer_phone);
  if (!validId(listingId) || amount === null ||
      quantity.length < 1 || quantity.length > 120 ||
      note.length > 500 || !buyerPhone) {
    fail('OFFER_INVALID', 400);
  }

  const createdAt = now.toISOString();
  const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
  await withImmediateTransaction(database, async tx => {
    const listing = await tx.get(
      `SELECT l.id, l.title, l.phone, l.submitted_by, l.status, l.expires_at,
              s.enabled
         FROM listings l
         LEFT JOIN private__listing_offer_settings s ON s.listing_id = l.id
        WHERE l.id = ?
        LIMIT 1`,
      Number(listingId),
    );
    if (!listing || listing.status !== 'approved' || !listing.expires_at ||
        typeof listing.submitted_by !== 'string' || !listing.submitted_by ||
        Date.parse(listing.expires_at) <= now.getTime() || Number(listing.enabled) !== 1) {
      fail('OFFER_NOT_AVAILABLE', 409);
    }
    if (listing.submitted_by === userId) fail('OFFER_NOT_OWNER', 403);

    const openOffer = await tx.get(
      `SELECT id FROM private__listing_offers
        WHERE listing_id = ? AND buyer_id = ?
          AND status IN ('pending', 'countered')
        LIMIT ?`,
      Number(listingId),
      userId,
      MAX_OPEN_OFFERS_PER_LISTING,
    );
    if (openOffer) fail('OFFER_CONFLICT', 409);

    const buyerCount = await tx.get(
      `SELECT COUNT(*) AS count FROM private__listing_offers
        WHERE buyer_id = ? AND created_at >= ?`,
      userId,
      cutoff,
    );
    if (Number(buyerCount?.count || 0) >= MAX_BUYER_OFFERS_PER_DAY) {
      fail('OFFER_LIMIT', 429);
    }

    await tx.run(
      `INSERT INTO private__listing_offers(
         id, listing_id, title_snapshot, seller_phone_snapshot, seller_id,
         buyer_id, amount, counter_amount, quantity, note, buyer_phone,
         status, created_at, updated_at
       ) VALUES(?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'pending', ?, ?)`,
      randomUUID(),
      Number(listingId),
      String(listing.title),
      String(listing.phone),
      String(listing.submitted_by),
      userId,
      amount,
      quantity,
      note,
      buyerPhone,
      createdAt,
      createdAt,
    );
  });
}

async function respondToOffer(database, userId, payload, now) {
  const offerId = typeof payload?.p_offer_id === 'string' ? payload.p_offer_id : '';
  const action = payload?.p_action;
  const amount = action === 'counter' ? validAmount(payload?.p_amount) : null;
  if (!/^[0-9a-f-]{36}$/i.test(offerId) ||
      !['accept', 'decline', 'counter', 'buyer_accept', 'buyer_decline'].includes(action) ||
      action === 'counter' && amount === null) {
    fail('OFFER_INVALID', 400);
  }
  await withImmediateTransaction(database, async tx => {
    const offer = await tx.get(
      `SELECT id, buyer_id, seller_id, status, counter_amount
         FROM private__listing_offers
        WHERE id = ?
        LIMIT 1`,
      offerId,
    );
    if (!offer || offer.buyer_id !== userId && offer.seller_id !== userId) {
      fail('OFFER_NOT_AVAILABLE', 404);
    }
    let result;
    if (['accept', 'decline', 'counter'].includes(action)) {
      if (offer.seller_id !== userId) fail('OFFER_NOT_OWNER', 403);
      if (offer.status !== 'pending') fail('OFFER_CONFLICT', 409);
      if (action === 'counter') {
        result = await tx.run(
          `UPDATE private__listing_offers
              SET status = 'countered', counter_amount = ?, updated_at = ?
            WHERE id = ? AND seller_id = ? AND status = 'pending'`,
          amount,
          now.toISOString(),
          offerId,
          userId,
        );
      } else {
        result = await tx.run(
          `UPDATE private__listing_offers
              SET status = ?, updated_at = ?
            WHERE id = ? AND seller_id = ? AND status = 'pending'`,
          action === 'accept' ? 'accepted' : 'declined',
          now.toISOString(),
          offerId,
          userId,
        );
      }
    } else {
      if (offer.buyer_id !== userId) fail('OFFER_NOT_OWNER', 403);
      if (offer.status !== 'countered') fail('OFFER_CONFLICT', 409);
      result = action === 'buyer_accept'
        ? await tx.run(
          `UPDATE private__listing_offers
              SET status = 'accepted', amount = counter_amount,
                  counter_amount = NULL, updated_at = ?
            WHERE id = ? AND buyer_id = ? AND status = 'countered'
              AND counter_amount IS NOT NULL`,
          now.toISOString(),
          offerId,
          userId,
        )
        : await tx.run(
          `UPDATE private__listing_offers
              SET status = 'declined', updated_at = ?
            WHERE id = ? AND buyer_id = ? AND status = 'countered'`,
          now.toISOString(),
          offerId,
          userId,
        );
    }
    if (Number(result?.rowsAffected ?? result?.changes ?? 0) !== 1) {
      fail('OFFER_CONFLICT', 409);
    }
  });
}

async function sendOfferMessage(database, userId, payload, now) {
  const offerId = typeof payload?.p_offer_id === 'string' ? payload.p_offer_id : '';
  const body = cleanText(payload?.p_body, 1000);
  if (!/^[0-9a-f-]{36}$/i.test(offerId) || body.length < 1 || body.length > 1000) {
    fail('OFFER_INVALID', 400);
  }
  const createdAt = now.toISOString();
  const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
  await withImmediateTransaction(database, async tx => {
    const offer = await tx.get(
      `SELECT id, buyer_id, seller_id, status
         FROM private__listing_offers
        WHERE id = ?
        LIMIT 1`,
      offerId,
    );
    if (!offer || offer.buyer_id !== userId && offer.seller_id !== userId) {
      fail('OFFER_NOT_AVAILABLE', 404);
    }
    if (offer.status !== 'accepted') fail('OFFER_CONFLICT', 409);
    const messageCount = await tx.get(
      `SELECT COUNT(*) AS count
         FROM private__listing_offer_messages
        WHERE offer_id = ? AND actor_id = ? AND created_at >= ?`,
      offerId,
      userId,
      cutoff,
    );
    if (Number(messageCount?.count || 0) >= MAX_MESSAGES_PER_PARTY_PER_OFFER_PER_DAY) {
      fail('OFFER_MESSAGE_LIMIT', 429);
    }
    await tx.run(
      `INSERT INTO private__listing_offer_messages(id, offer_id, actor_id, body, created_at)
       VALUES(?, ?, ?, ?, ?)`,
      randomUUID(),
      offerId,
      userId,
      body,
      createdAt,
    );
  });
}

export async function mutateTursoOffer(database, userId, payload, now = new Date()) {
  if (!userId) fail('OFFER_LOGIN_REQUIRED', 401);
  const action = payload?.action;
  if (action === 'set_listing_offer_enabled') {
    return updateOfferSetting(database, userId, payload?.p_listing_id, payload?.p_enabled, now);
  }
  if (action === 'create_listing_offer') {
    return createOffer(database, userId, payload, now);
  }
  if (action === 'respond_to_listing_offer') {
    return respondToOffer(database, userId, payload, now);
  }
  if (action === 'send_listing_offer_message') {
    return sendOfferMessage(database, userId, payload, now);
  }
  fail('OFFER_INVALID', 400);
}
