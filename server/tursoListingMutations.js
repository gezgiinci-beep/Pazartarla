import { createHash } from 'node:crypto';
import { readTursoSubmissionData } from './tursoSubmissionData.js';
import { captureTursoListingContact } from './tursoContactDepot.js';

const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_IMAGES = 10;
const MAX_IMAGE_URL_LENGTH = 2048;
const LISTING_COLUMNS = [
  'id', 'title', 'price', 'category', '"subCategory"', 'mode', 'location',
  'amount', 'description', 'seller', 'phone', 'image', 'seotags', 'status',
  'created_at', 'submitted_by', 'expires_at', 'is_featured', 'gallery_paths',
];

export class TursoListingMutationError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.name = 'TursoListingMutationError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new TursoListingMutationError(code, status);
}

function withImmediateTransaction(database, callback) {
  if (typeof database?.transactionAsync !== 'function') {
    throw new Error('Turso transaction support is required for listing writes.');
  }
  const transaction = database.transactionAsync(callback);
  if (typeof transaction?.immediate !== 'function') {
    throw new Error('Turso immediate transactions are unavailable.');
  }
  return transaction.immediate();
}

function cleanText(value, maxLength, { required = false } = {}) {
  if (typeof value !== 'string') fail('LISTING_INVALID', 400);
  const cleaned = value.replace(/\u0000/g, '').trim();
  if (cleaned.length > maxLength || (required && cleaned.length === 0)) {
    fail('LISTING_INVALID', 400);
  }
  return cleaned;
}

function validImages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_IMAGES) {
    fail('LISTING_MEDIA_INVALID', 400);
  }
  return value.map(image => {
    if (typeof image !== 'string' || image.startsWith('data:')) {
      fail('LISTING_MEDIA_STORAGE_REQUIRED', 409);
    }
    try {
      const url = new URL(image);
      if (url.protocol !== 'https:' || url.username || url.password ||
          url.href.length > MAX_IMAGE_URL_LENGTH) {
        fail('LISTING_MEDIA_INVALID', 400);
      }
      return url.href;
    } catch (error) {
      if (error instanceof TursoListingMutationError) throw error;
      fail('LISTING_MEDIA_INVALID', 400);
    }
  });
}

function timePartsInIstanbul(date) {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(fields
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
}

function timezoneOffsetMilliseconds(date) {
  const parts = timePartsInIstanbul(date);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.fractionalSecond,
  ) - date.getTime();
}

export function listingExpiryAfterOneIstanbulYear(date) {
  const parts = timePartsInIstanbul(date);
  const targetMonthIndex = parts.month - 1;
  const targetYear = parts.year + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetLocalAsUtc = Date.UTC(
    targetYear,
    targetMonthIndex,
    Math.min(parts.day, lastDay),
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );
  let estimate = new Date(targetLocalAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    estimate = new Date(targetLocalAsUtc - timezoneOffsetMilliseconds(estimate));
  }
  return estimate.toISOString();
}

function listingSnapshot(row) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function publicListing(row) {
  let galleryPaths = [];
  if (typeof row.gallery_paths === 'string' && row.gallery_paths) {
    try {
      const parsed = JSON.parse(row.gallery_paths);
      if (Array.isArray(parsed)) galleryPaths = parsed;
    } catch {
      fail('LISTING_MEDIA_INVALID', 503);
    }
  } else if (Array.isArray(row.gallery_paths)) {
    galleryPaths = row.gallery_paths;
  }
  return {
    ...row,
    price: Number(row.price),
    is_featured: row.is_featured == null ? null : Boolean(row.is_featured),
    gallery_paths: galleryPaths,
  };
}

function validAdminSession(session, now) {
  if (session?.is_admin !== true || !session?.user?.id) return false;
  const reauth = Date.parse(session.admin_reauth_at || '');
  return Number.isFinite(reauth) && reauth <= now.getTime() &&
    now.getTime() - reauth <= ADMIN_REAUTH_WINDOW_MS;
}

function listingId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail('LISTING_INVALID', 400);
  return id;
}

export async function createTursoListing(database, session, payload, now = new Date()) {
  if (!session?.user?.id || !session.user.email_confirmed_at ||
      session.user.is_anonymous === true) {
    fail('LISTING_VERIFIED_ACCOUNT_REQUIRED', 403);
  }

  const title = cleanText(payload?.title, 200, { required: true });
  const category = cleanText(payload?.category, 120, { required: true });
  const subCategory = cleanText(payload?.subCategory, 120, { required: true });
  const mode = cleanText(payload?.mode ?? 'Satılık', 80);
  const location = cleanText(payload?.location ?? '', 200);
  const description = cleanText(payload?.description ?? '', 5000);
  const seller = cleanText(payload?.seller, 120, { required: true });
  const phone = cleanText(payload?.phone, 32, { required: true });
  if (!/^[+0-9 ()-]{5,32}$/.test(phone)) fail('LISTING_INVALID', 400);

  const price = typeof payload?.price === 'number' ? payload.price : Number(payload?.price);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000_000) {
    fail('LISTING_INVALID', 400);
  }

  const images = validImages(payload?.images);
  const seoTags = cleanText(payload?.seoTags ?? '', 20_000);
  const createdAt = now.toISOString();
  const expiresAt = listingExpiryAfterOneIstanbulYear(now);
  return withImmediateTransaction(database, async transaction => {
    const settings = await transaction.get(
      `SELECT categories FROM site_settings WHERE id = 'public' LIMIT 1`,
    );
    let categories;
    try {
      categories = typeof settings?.categories === 'string'
        ? JSON.parse(settings.categories)
        : settings?.categories;
    } catch {
      fail('LISTING_CATEGORY_INVALID', 503);
    }
    if (!categories || !Array.isArray(categories[category]) ||
        !categories[category].includes(subCategory)) {
      fail('LISTING_CATEGORY_INVALID', 400);
    }
    const submission = await readTursoSubmissionData(transaction, {
      userId: session.user.id,
      isAdmin: session.is_admin === true,
      emailVerified: Boolean(session.user.email_confirmed_at),
      now,
    });
    if (!submission.quota.can_submit) {
      if (submission.quota.period === 'membership_month' &&
          submission.quota.monthly_remaining === 0) {
        fail('LISTING_MONTHLY_LIMIT_REACHED', 429);
      }
      if (submission.quota.active_limit != null &&
          Number(submission.quota.active_used || 0) +
            Number(submission.quota.pending_reserved || 0) >=
            Number(submission.quota.active_limit)) {
        fail('LISTING_ACTIVE_LIMIT_REACHED', 429);
      }
      fail('LISTING_DAILY_LIMIT_REACHED', 429);
    }

    await transaction.run(
      `INSERT INTO listings
        (title, price, category, "subCategory", mode, location, description,
         seller, phone, image, seotags, status, created_at, submitted_by,
         expires_at, is_featured, gallery_paths)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0, ?)`,
      title,
      price,
      category,
      subCategory,
      mode,
      location || null,
      description,
      seller,
      phone,
      images[0],
      seoTags,
      createdAt,
      session.user.id,
      expiresAt,
      JSON.stringify(images),
    );
    const created = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')}
         FROM listings WHERE id = last_insert_rowid() LIMIT 1`,
    );
    if (!created) throw new Error('LISTING_INSERT_READBACK_FAILED');
    await captureTursoListingContact(transaction, {
      listingId: created.id,
      userId: session.user.id,
      email: session.user.email,
      emailVerified: Boolean(session.user.email_confirmed_at),
      isAdmin: session.is_admin === true,
      seller,
      rawPhone: phone,
      now,
    });
    await transaction.run(
      `INSERT INTO private__listing_submission_log(user_id, submitted_at)
       VALUES (?, ?)`,
      session.user.id,
      createdAt,
    );
    if (payload?.offerRequested === true) {
      await transaction.run(
        `INSERT INTO private__listing_offer_settings(listing_id, enabled, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(listing_id) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at`,
        Number(created.id),
        createdAt,
      );
    }
    return { listing: publicListing(created) };
  });
}

export async function readTursoModerationQueue(database, now = new Date()) {
  const rows = await database.all(
    `SELECT ${LISTING_COLUMNS.join(', ')}
       FROM listings
      WHERE status = 'pending' AND expires_at > ?
      ORDER BY created_at ASC, id ASC
      LIMIT 500`,
    now.toISOString(),
  );
  if (!Array.isArray(rows)) throw new Error('INVALID_MODERATION_QUEUE');
  return rows.map(row => ({
    listing: publicListing(row),
    edit_token: listingSnapshot(row),
  }));
}

export async function readTursoAdminListingForEdit(database, session, idValue, now = new Date()) {
  const id = listingId(idValue);
  if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
  const row = await database.get(
    `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
    id,
  );
  if (!row) fail('LISTING_EDIT_CONFLICT', 409);
  return { listing: publicListing(row), edit_token: listingSnapshot(row) };
}

function assertOwnerEditor(session, row, now) {
  if (session?.is_admin === true) {
    if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
    return true;
  }
  if (!session?.user?.id || !session.user.email_confirmed_at ||
      session.user.is_anonymous === true || row.submitted_by !== session.user.id ||
      row.status === 'archived' || !row.expires_at ||
      Date.parse(row.expires_at) <= now.getTime()) {
    fail('LISTING_EDIT_FORBIDDEN', 403);
  }
  return false;
}

export async function readTursoOwnerListingForEdit(
  database, session, idValue, now = new Date(),
) {
  const id = listingId(idValue);
  const row = await database.get(
    `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
    id,
  );
  if (!row) fail('LISTING_EDIT_FORBIDDEN', 403);
  assertOwnerEditor(session, row, now);
  return { listing: publicListing(row), edit_token: listingSnapshot(row) };
}

export async function updateTursoOwnerListingDetails(
  database, session, idValue, changes, editToken, now = new Date(),
) {
  const id = listingId(idValue);
  const editable = new Set([
    'title', 'price', 'category', 'subCategory', 'location',
    'description', 'seller', 'phone',
  ]);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
      typeof editToken !== 'string' || !/^[a-f0-9]{64}$/.test(editToken) ||
      Object.keys(changes).some(key => !editable.has(key))) {
    fail('LISTING_EDIT_INVALID', 400);
  }

  return withImmediateTransaction(database, async transaction => {
    const original = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!original) fail('LISTING_EDIT_FORBIDDEN', 403);
    const isAdmin = assertOwnerEditor(session, original, now);
    if (listingSnapshot(original) !== editToken) fail('LISTING_EDIT_CONFLICT', 409);

    const candidate = { ...original };
    const textFields = {
      title: [200, true],
      category: [120, true],
      subCategory: [120, true],
      location: [200, false],
      description: [5000, false],
      seller: [120, true],
      phone: [32, true],
    };
    for (const [field, [maxLength, required]] of Object.entries(textFields)) {
      if (!Object.hasOwn(changes, field)) continue;
      candidate[field] = cleanText(changes[field], maxLength, { required });
    }
    if (Object.hasOwn(changes, 'price')) {
      if (typeof changes.price !== 'number' || !Number.isFinite(changes.price) ||
          changes.price < 0 || changes.price > 1_000_000_000_000) {
        fail('LISTING_EDIT_INVALID', 400);
      }
      candidate.price = changes.price;
    }
    if (Object.hasOwn(changes, 'phone') &&
        !/^[+0-9 ()-]{5,32}$/.test(candidate.phone)) {
      fail('LISTING_EDIT_INVALID', 400);
    }

    if (candidate.category !== original.category ||
        candidate.subCategory !== original.subCategory) {
      const settings = await transaction.get(
        `SELECT categories FROM site_settings WHERE id = 'public' LIMIT 1`,
      );
      let categories;
      try {
        categories = typeof settings?.categories === 'string'
          ? JSON.parse(settings.categories) : settings?.categories;
      } catch {
        fail('LISTING_CATEGORY_INVALID', 503);
      }
      if (!categories || !Array.isArray(categories[candidate.category]) ||
          !categories[candidate.category].includes(candidate.subCategory)) {
        fail('LISTING_CATEGORY_INVALID', 400);
      }
    }

    const changed = [...editable].some(field => {
      if (!Object.hasOwn(changes, field)) return false;
      return candidate[field] !== original[field];
    });
    if (!changed) {
      return {
        listing: publicListing(original),
        edit_token: listingSnapshot(original),
        changed: false,
        reapproval_required: false,
      };
    }

    await transaction.run(
      `UPDATE listings
          SET title = ?, price = ?, category = ?, "subCategory" = ?,
              location = ?, description = ?, seller = ?, phone = ?,
              status = ?
        WHERE id = ?`,
      candidate.title,
      candidate.price,
      candidate.category,
      candidate.subCategory,
      candidate.location || null,
      candidate.description,
      candidate.seller,
      candidate.phone,
      isAdmin ? original.status : 'pending',
      id,
    );
    const saved = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || saved.title !== candidate.title ||
        Number(saved.price) !== candidate.price ||
        saved.category !== candidate.category ||
        saved.subCategory !== candidate.subCategory ||
        saved.seller !== candidate.seller || saved.phone !== candidate.phone) {
      throw new Error('LISTING_EDIT_READBACK_FAILED');
    }
    return {
      listing: publicListing(saved),
      edit_token: listingSnapshot(saved),
      changed: true,
      reapproval_required: !isAdmin,
    };
  });
}

export async function updateTursoOwnerListingArchive(
  database, session, idValue, editToken, action, now = new Date(),
) {
  const id = listingId(idValue);
  if (!['archive', 'restore'].includes(action) ||
      typeof editToken !== 'string' || !/^[a-f0-9]{64}$/.test(editToken)) {
    fail('LISTING_INVALID', 400);
  }
  if (!session?.user?.id || session.user.is_anonymous === true ||
      !session.user.email_confirmed_at || session.is_admin === true) {
    fail('LISTING_EDIT_FORBIDDEN', 403);
  }
  return withImmediateTransaction(database, async transaction => {
    const original = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')}
         FROM listings WHERE id = ? AND submitted_by = ? LIMIT 1`,
      id,
      session.user.id,
    );
    if (!original || listingSnapshot(original) !== editToken) {
      fail(original ? 'LISTING_EDIT_CONFLICT' : 'LISTING_EDIT_FORBIDDEN',
        original ? 409 : 403);
    }
    if (action === 'archive') {
      if (original.status === 'archived') fail('LISTING_EDIT_CONFLICT', 409);
    } else if (original.status !== 'archived' ||
        !original.expires_at || Date.parse(original.expires_at) <= now.getTime()) {
      fail('LISTING_EDIT_FORBIDDEN', 403);
    }
    const status = action === 'archive' ? 'archived' : 'pending';
    await transaction.run('UPDATE listings SET status = ? WHERE id = ?', status, id);
    const saved = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || saved.status !== status) throw new Error('LISTING_ARCHIVE_READBACK_FAILED');
    return { listing: publicListing(saved), edit_token: listingSnapshot(saved) };
  });
}

export async function updateTursoListingMedia(
  database, session, idValue, editToken, changes, now = new Date(),
) {
  const id = listingId(idValue);
  if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
  if (typeof editToken !== 'string' || !/^[a-f0-9]{64}$/.test(editToken) ||
      !changes || typeof changes !== 'object' || Array.isArray(changes)) {
    fail('LISTING_INVALID', 400);
  }
  const gallery = validImages(changes.gallery_paths);
  const image = typeof changes.image === 'string' ? changes.image : '';
  const seoTags = typeof changes.seotags === 'string' ? changes.seotags.trim() : '';
  if (gallery[0] !== image || seoTags.length > 4096 ||
      /data:image\/[^;,]+;base64,/i.test(seoTags)) fail('LISTING_MEDIA_INVALID', 400);
  return withImmediateTransaction(database, async transaction => {
    const original = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!original || listingSnapshot(original) !== editToken) fail('LISTING_EDIT_CONFLICT', 409);
    await transaction.run(
      `UPDATE listings SET image = ?, gallery_paths = ?, seotags = ? WHERE id = ?`,
      image,
      JSON.stringify(gallery),
      seoTags,
      id,
    );
    const saved = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || saved.image !== image || saved.seotags !== seoTags) {
      throw new Error('LISTING_MEDIA_READBACK_FAILED');
    }
    return { listing: publicListing(saved), edit_token: listingSnapshot(saved) };
  });
}

export async function updateTursoListingFeatured(database, session, idValue, editToken, featured, now = new Date()) {
  const id = listingId(idValue);
  if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
  if (typeof editToken !== 'string' || !/^[a-f0-9]{64}$/.test(editToken) ||
      typeof featured !== 'boolean') fail('LISTING_INVALID', 400);
  return withImmediateTransaction(database, async transaction => {
    const original = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!original || listingSnapshot(original) !== editToken) fail('LISTING_EDIT_CONFLICT', 409);
    await transaction.run('UPDATE listings SET is_featured = ? WHERE id = ?', featured ? 1 : 0, id);
    const saved = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || Number(saved.is_featured) !== (featured ? 1 : 0)) {
      throw new Error('LISTING_FEATURE_READBACK_FAILED');
    }
    return { listing: publicListing(saved), edit_token: listingSnapshot(saved) };
  });
}

export async function moderateTursoListing(
  database, session, idValue, decision, editToken, now = new Date(),
) {
  const id = listingId(idValue);
  if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
  if (!['approved', 'rejected'].includes(decision) ||
      typeof editToken !== 'string' || !/^[a-f0-9]{64}$/.test(editToken)) {
    fail('LISTING_INVALID', 400);
  }

  return withImmediateTransaction(database, async transaction => {
    const original = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!original || original.status !== 'pending' ||
        !original.expires_at || Date.parse(original.expires_at) <= now.getTime() ||
        listingSnapshot(original) !== editToken) {
      fail('LISTING_EDIT_CONFLICT', 409);
    }
    await transaction.run(
      `UPDATE listings SET status = ? WHERE id = ? AND status = 'pending'`,
      decision,
      id,
    );
    const saved = await transaction.get(
      `SELECT ${LISTING_COLUMNS.join(', ')} FROM listings WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || saved.status !== decision) throw new Error('LISTING_MODERATION_READBACK_FAILED');
    return { listing: publicListing(saved) };
  });
}

export async function deleteTursoListing(database, session, idValue, now = new Date()) {
  const id = listingId(idValue);
  if (!validAdminSession(session, now)) fail('LISTING_ADMIN_REAUTH_REQUIRED', 403);
  return withImmediateTransaction(database, async transaction => {
    const existing = await transaction.get('SELECT id FROM listings WHERE id = ? LIMIT 1', id);
    if (!existing) fail('LISTING_EDIT_CONFLICT', 409);
    const result = await transaction.run('DELETE FROM listings WHERE id = ?', id);
    if (Number(result?.rowsAffected ?? result?.changes) !== 1) {
      fail('LISTING_EDIT_CONFLICT', 409);
    }
    return { deleted_id: id };
  });
}
