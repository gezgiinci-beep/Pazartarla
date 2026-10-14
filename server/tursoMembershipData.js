const STORE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING_COLUMNS = [
  'id', 'title', 'price', 'category', '"subCategory"', 'mode', 'location',
  'amount', 'description', 'seller', 'phone', 'image', 'gallery_paths',
  'is_featured', 'status', 'created_at', 'expires_at',
];

const PLAN_ORDER = `CASE id
  WHEN 'package-1' THEN 1
  WHEN 'package-2' THEN 2
  WHEN 'package-3' THEN 3
  WHEN 'trial-30-days' THEN 4
  ELSE 5
END, id`;

function normalizePlan(row) {
  return {
    ...row,
    monthly_price_try: row.monthly_price_try == null ? null : Number(row.monthly_price_try),
    annual_price_try: row.annual_price_try == null ? null : Number(row.annual_price_try),
    monthly_limit: row.monthly_limit == null ? null : Number(row.monthly_limit),
    active_limit: row.active_limit == null ? null : Number(row.active_limit),
    trial_days: row.trial_days == null ? null : Number(row.trial_days),
  };
}

function normalizeStore(row, listingIds, admin = false) {
  const result = {
    id: String(row.id).toLowerCase(),
    name: row.name,
    description: row.description,
    revision: Number(row.revision),
    listing_ids: listingIds,
  };
  if (admin) {
    result.is_public = Boolean(row.is_public);
    result.membership_ends_at = row.ends_at;
  }
  return result;
}

function normalizeRequest(row, admin = false) {
  const result = {
    id: String(row.id).toLowerCase(),
    revision: Number(row.revision),
    plan_id: row.plan_id,
    plan_name: row.plan_name,
    billing_period: row.billing_period ?? 'month',
    trial_days: row.trial_days == null ? null : Number(row.trial_days),
    monthly_price_try: row.monthly_price_try == null ? null : Number(row.monthly_price_try),
    annual_price_try: row.annual_price_try == null ? null : Number(row.annual_price_try),
    monthly_limit: row.monthly_limit == null ? null : Number(row.monthly_limit),
    active_limit: row.active_limit == null ? null : Number(row.active_limit),
    store_name: row.store_name,
    status: row.status,
    created_at: row.created_at,
  };
  if (admin && typeof row.email === 'string') result.email = row.email;
  return result;
}

async function listingIdsForOwner(database, ownerId, now) {
  const rows = await database.all(
    `SELECT id FROM listings
      WHERE submitted_by = ? AND status = ? AND expires_at > ?
      ORDER BY created_at DESC, id DESC`,
    ownerId,
    'approved',
    now,
  );
  return rows.map(row => Number(row.id)).filter(Number.isSafeInteger);
}

async function activeStores(database, now, { publicOnly }) {
  const rows = await database.all(
    `SELECT s.id, s.owner_id, s.name, s.description, s.revision, s.is_public, m.ends_at
       FROM private__member_stores s
       JOIN private__store_memberships m ON m.owner_id = s.owner_id
      WHERE m.starts_at <= ? AND m.ends_at > ? ${publicOnly ? 'AND s.is_public = 1' : ''}
      ORDER BY s.name COLLATE NOCASE, s.id`,
    now,
    now,
  );
  const stores = [];
  for (const row of rows) {
    const listingIds = await listingIdsForOwner(database, row.owner_id, now);
    stores.push(normalizeStore(row, listingIds, !publicOnly));
  }
  return stores;
}

async function activeStorePage(database, storeId, now) {
  if (!storeId) return { store: null, listings: [] };
  const row = await database.get(
    `SELECT s.id, s.owner_id, s.name, s.description, s.revision
       FROM private__member_stores s
       JOIN private__store_memberships m ON m.owner_id = s.owner_id
      WHERE s.id = ? AND s.is_public = 1 AND m.starts_at <= ? AND m.ends_at > ?
      LIMIT 1`,
    storeId,
    now,
    now,
  );
  if (!row) return { store: null, listings: [] };
  const listingRows = await database.all(
    `SELECT ${LISTING_COLUMNS.join(', ')}
       FROM listings
      WHERE submitted_by = ? AND status = ? AND expires_at > ?
      ORDER BY created_at DESC, id DESC`,
    row.owner_id,
    'approved',
    now,
  );
  const listings = listingRows.map(listing => ({
    ...listing,
    price: Number.isFinite(Number(listing.price)) ? Number(listing.price) : listing.price,
    gallery_paths: parseGalleryPaths(listing.gallery_paths),
    is_featured: listing.is_featured == null ? null : Boolean(listing.is_featured),
  }));
  return {
    store: {
      id: String(row.id).toLowerCase(),
      name: row.name,
      description: row.description,
      revision: Number(row.revision),
      listing_ids: listings.map(listing => Number(listing.id)).filter(Number.isSafeInteger),
    },
    listings,
  };
}

function parseGalleryPaths(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function memberData(database, ownerId) {
  const storeRow = await database.get(
    `SELECT id, name, description, revision
       FROM private__member_stores WHERE owner_id = ? LIMIT 1`,
    ownerId,
  );
  const membership = await database.get(
    `SELECT plan_name, billing_period, trial_days, monthly_limit, active_limit,
            starts_at, ends_at, revision
       FROM private__store_memberships WHERE owner_id = ? LIMIT 1`,
    ownerId,
  );
  const requestRows = await database.all(
    `SELECT id, revision, plan_id, plan_name, billing_period, trial_days,
            monthly_price_try, annual_price_try, monthly_limit, active_limit,
            store_name, status, created_at
       FROM private__store_requests WHERE owner_id = ?
      ORDER BY created_at DESC, id DESC`,
    ownerId,
  );
  const trial = await database.get(
    'SELECT 1 AS used FROM private__store_trial_ledger WHERE owner_id = ? LIMIT 1',
    ownerId,
  );
  return {
    store: storeRow ? normalizeStore(storeRow, []) : null,
    membership: membership ? {
      ...membership,
      billing_period: membership.billing_period ?? 'month',
      trial_days: membership.trial_days == null ? null : Number(membership.trial_days),
      monthly_limit: membership.monthly_limit == null ? null : Number(membership.monthly_limit),
      active_limit: membership.active_limit == null ? null : Number(membership.active_limit),
      revision: Number(membership.revision),
    } : null,
    requests: requestRows.map(row => normalizeRequest(row)),
    trial_used: Boolean(trial),
  };
}

async function adminData(database, now) {
  const rows = await database.all(
    `SELECT r.id, r.revision, r.plan_id, r.plan_name, r.billing_period, r.trial_days,
            r.monthly_price_try, r.annual_price_try, r.monthly_limit, r.active_limit,
            r.store_name, r.status, r.created_at, u.email
       FROM private__store_requests r
       LEFT JOIN app_users u ON u.id = r.owner_id
      ORDER BY r.created_at DESC, r.id DESC`,
  );
  return {
    requests: rows.map(row => normalizeRequest(row, true)),
    stores: await activeStores(database, now, { publicOnly: false }),
  };
}

export async function readTursoStoreMembershipData(database, {
  storeId = null,
  session = null,
  now = new Date(),
} = {}) {
  const nowText = now.toISOString();
  const plans = await database.all(
    `SELECT id, name, billing_period, trial_days, monthly_price_try, annual_price_try,
            monthly_limit, active_limit
       FROM private__store_plans
      ORDER BY ${PLAN_ORDER}`,
  );
  const stores = await activeStores(database, nowText, { publicOnly: true });
  const selected = await activeStorePage(database, storeId, nowText);

  let mine = null;
  let requests = [];
  let adminStores = [];
  if (session?.user?.id) {
    mine = await memberData(database, session.user.id);
    if (session.is_admin) {
      const admin = await adminData(database, nowText);
      requests = admin.requests;
      adminStores = admin.stores;
    }
  }

  return {
    plans: plans.map(normalizePlan),
    stores,
    store: selected.store,
    listings: selected.listings,
    mine,
    requests,
    admin_stores: adminStores,
  };
}

export function validStoreId(value) {
  return typeof value === 'string' && STORE_ID_PATTERN.test(value);
}
