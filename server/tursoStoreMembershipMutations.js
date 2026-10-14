import { randomUUID } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRIAL_PLAN_ID = 'trial-30-days';

export class StoreMembershipMutationError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.name = 'StoreMembershipMutationError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new StoreMembershipMutationError(code, status);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength + 1) : '';
}

function validIdentity(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validStoreDetails(payload) {
  const name = cleanText(payload?.store_name, 100);
  const description = cleanText(payload?.description, 500);
  if (name.length < 2 || name.length > 100 || description.length > 500) {
    fail('MEMBERSHIP_INVALID', 400);
  }
  return { name, description };
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
  return Object.fromEntries(fields.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function timezoneOffsetMilliseconds(date) {
  const p = timePartsInIstanbul(date);
  return Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
    p.fractionalSecond,
  ) - date.getTime();
}

function addIstanbulCalendarPeriod(date, { months = 0, years = 0 }) {
  const p = timePartsInIstanbul(date);
  const monthIndex = p.month - 1 + months + years * 12;
  const targetYear = p.year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(p.day, lastDay);
  const targetLocalAsUtc = Date.UTC(
    targetYear,
    targetMonthIndex,
    targetDay,
    p.hour,
    p.minute,
    p.second,
    date.getUTCMilliseconds(),
  );
  let estimate = new Date(targetLocalAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    estimate = new Date(targetLocalAsUtc - timezoneOffsetMilliseconds(estimate));
  }
  return estimate.toISOString();
}

function addThirtyDays(date) {
  return new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function withImmediateTransaction(database, callback) {
  if (typeof database?.transactionAsync !== 'function') {
    throw new Error('Turso transaction support is required for membership writes.');
  }
  const transaction = database.transactionAsync(callback);
  if (typeof transaction?.immediate !== 'function') {
    throw new Error('Turso immediate transactions are unavailable.');
  }
  return transaction.immediate();
}

async function activeMembership(tx, ownerId, nowMs) {
  const membership = await tx.get(
    `SELECT owner_id, request_id, plan_name, billing_period, trial_days,
            monthly_limit, active_limit, starts_at, ends_at, revision
       FROM private__store_memberships
      WHERE owner_id = ?
      LIMIT 1`,
    ownerId,
  );
  const startsAt = Date.parse(membership?.starts_at || '');
  const endsAt = Date.parse(membership?.ends_at || '');
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= nowMs && endsAt > nowMs
    ? membership
    : null;
}

async function pendingRequest(tx, ownerId) {
  return tx.get(
    `SELECT id FROM private__store_requests
      WHERE owner_id = ? AND status = 'pending'
      LIMIT 1`,
    ownerId,
  );
}

async function ensureNoActiveOrPending(tx, ownerId, nowMs) {
  if (await activeMembership(tx, ownerId, nowMs)) fail('MEMBERSHIP_ACTIVE');
  if (await pendingRequest(tx, ownerId)) fail('MEMBERSHIP_PENDING');
}

async function insertMemberStore(tx, ownerId, storeName, description) {
  await tx.run(
    `INSERT INTO private__member_stores(id, owner_id, name, description, revision, is_public)
     VALUES(?, ?, ?, ?, 1, 1)
     ON CONFLICT(owner_id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       revision = private__member_stores.revision + 1`,
    randomUUID(),
    ownerId,
    storeName,
    description,
  );
}

async function insertMembership(tx, {
  ownerId,
  requestId,
  planName,
  billingPeriod,
  trialDays,
  monthlyLimit,
  activeLimit,
  startsAt,
  endsAt,
}) {
  await tx.run(
    `INSERT INTO private__store_memberships(
       owner_id, request_id, plan_name, billing_period, trial_days,
       monthly_limit, active_limit, starts_at, ends_at
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_id) DO UPDATE SET
       request_id = excluded.request_id,
       plan_name = excluded.plan_name,
       billing_period = excluded.billing_period,
       trial_days = excluded.trial_days,
       monthly_limit = excluded.monthly_limit,
       active_limit = excluded.active_limit,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       revision = private__store_memberships.revision + 1`,
    ownerId,
    requestId,
    planName,
    billingPeriod,
    trialDays,
    monthlyLimit,
    activeLimit,
    startsAt,
    endsAt,
  );
}

async function requestPlan(tx, userId, id, payload, nowMs, nowIso) {
  if (!validIdentity(id)) fail('MEMBERSHIP_INVALID', 400);
  const { name, description } = validStoreDetails(payload);
  const planId = cleanText(payload?.plan_id, 100);
  const plan = await tx.get('SELECT * FROM private__store_plans WHERE id = ? LIMIT 1', planId);
  if (!plan) fail('MEMBERSHIP_INVALID', 400);
  if (plan.billing_period === 'trial' || planId === TRIAL_PLAN_ID) {
    fail('MEMBERSHIP_TRIAL_DIRECT_ONLY', 400);
  }
  if (!['month', 'year'].includes(plan.billing_period) ||
      (plan.billing_period === 'month' && (!Number.isFinite(Number(plan.monthly_price_try)) || Number(plan.monthly_price_try) <= 0)) ||
      (plan.billing_period === 'year' && (!Number.isFinite(Number(plan.annual_price_try)) || Number(plan.annual_price_try) <= 0))) {
    fail('MEMBERSHIP_INVALID', 400);
  }

  const existing = await tx.get('SELECT * FROM private__store_requests WHERE id = ? LIMIT 1', id);
  if (existing) {
    if (existing.owner_id === userId && existing.plan_id === plan.id &&
        existing.store_name === name && existing.description === description) {
      return { ok: true, id };
    }
    fail('MEMBERSHIP_STALE');
  }
  await ensureNoActiveOrPending(tx, userId, nowMs);
  await tx.run(
    `INSERT INTO private__store_requests(
       id, owner_id, plan_id, plan_name, billing_period, trial_days,
       monthly_price_try, annual_price_try, monthly_limit, active_limit,
       store_name, description, status, revision, created_at
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?)`,
    id,
    userId,
    plan.id,
    plan.name,
    plan.billing_period,
    plan.trial_days ?? null,
    plan.monthly_price_try ?? null,
    plan.annual_price_try ?? null,
    plan.monthly_limit ?? null,
    plan.active_limit ?? null,
    name,
    description,
    nowIso,
  );
  return { ok: true, id };
}

async function updateStoreProfile(tx, userId, revision, payload, nowMs) {
  if (!Number.isSafeInteger(revision) || revision < 1) fail('MEMBERSHIP_INVALID', 400);
  const { name, description } = validStoreDetails(payload);
  if (!(await activeMembership(tx, userId, nowMs))) fail('MEMBERSHIP_INVALID', 409);
  const saved = await tx.get(
    `UPDATE private__member_stores
        SET name = ?, description = ?, revision = revision + 1
      WHERE owner_id = ? AND revision = ?
      RETURNING id, revision`,
    name,
    description,
    userId,
    revision,
  );
  if (!saved) fail('MEMBERSHIP_STALE');
  return { ok: true, id: saved.id, revision: Number(saved.revision) };
}

async function startTrial(tx, userId, id, revision, payload, nowDate, nowIso) {
  if (!validIdentity(id) || revision !== null || payload?.plan_id !== TRIAL_PLAN_ID) {
    fail('MEMBERSHIP_INVALID', 400);
  }
  const { name, description } = validStoreDetails(payload);
  const ledger = await tx.get('SELECT * FROM private__store_trial_ledger WHERE owner_id = ? LIMIT 1', userId);
  if (ledger) {
    const prior = await tx.get('SELECT * FROM private__store_requests WHERE id = ? LIMIT 1', ledger.request_id);
    const membership = await tx.get(
      `SELECT * FROM private__store_memberships
        WHERE owner_id = ? AND request_id = ? AND billing_period = 'trial'
        LIMIT 1`,
      userId,
      id,
    );
    if (ledger.request_id === id && Date.parse(ledger.ends_at) > nowDate.getTime() &&
        Date.parse(membership?.starts_at || '') <= nowDate.getTime() &&
        Date.parse(membership?.ends_at || '') > nowDate.getTime() &&
        prior?.store_name === name && prior?.description === description && membership) {
      return { ok: true, id, ends_at: ledger.ends_at };
    }
    fail('MEMBERSHIP_TRIAL_USED');
  }
  await ensureNoActiveOrPending(tx, userId, nowDate.getTime());
  if (await tx.get('SELECT id FROM private__store_requests WHERE id = ? LIMIT 1', id)) {
    fail('MEMBERSHIP_STALE');
  }
  const plan = await tx.get('SELECT * FROM private__store_plans WHERE id = ? LIMIT 1', TRIAL_PLAN_ID);
  if (!plan || plan.billing_period !== 'trial' || Number(plan.trial_days) !== 30 ||
      plan.monthly_price_try != null || plan.annual_price_try != null ||
      plan.monthly_limit != null || plan.active_limit != null) {
    fail('MEMBERSHIP_INVALID', 400);
  }
  const endsAt = addThirtyDays(nowDate);
  await tx.run(
    `INSERT INTO private__store_requests(
       id, owner_id, plan_id, plan_name, billing_period, trial_days,
       monthly_price_try, annual_price_try, monthly_limit, active_limit,
       store_name, description, status, revision, created_at, decided_at
     ) VALUES(?, ?, ?, ?, 'trial', 30, NULL, NULL, NULL, NULL, ?, ?, 'approved', 1, ?, ?)`,
    id,
    userId,
    plan.id,
    plan.name,
    name,
    description,
    nowIso,
    nowIso,
  );
  await tx.run(
    'INSERT INTO private__store_trial_ledger(owner_id, request_id, starts_at, ends_at) VALUES(?, ?, ?, ?)',
    userId,
    id,
    nowIso,
    endsAt,
  );
  await insertMemberStore(tx, userId, name, description);
  await insertMembership(tx, {
    ownerId: userId,
    requestId: id,
    planName: plan.name,
    billingPeriod: 'trial',
    trialDays: 30,
    monthlyLimit: null,
    activeLimit: null,
    startsAt: nowIso,
    endsAt,
  });
  return { ok: true, id, ends_at: endsAt };
}

async function countSlots(tx, ownerId, nowIso) {
  const rows = await tx.all(
    `SELECT status, expires_at FROM listings
      WHERE submitted_by = ? AND status IN ('approved', 'pending')`,
    ownerId,
  );
  const nowMs = Date.parse(nowIso);
  return rows.reduce((slots, row) => {
    if (Date.parse(row.expires_at || '') > nowMs) {
      if (row.status === 'approved') slots.active += 1;
      if (row.status === 'pending') slots.pending += 1;
    }
    return slots;
  }, { active: 0, pending: 0 });
}

async function decideRequest(tx, adminId, id, revision, payload, nowDate, nowIso) {
  if (!validIdentity(id) || !Number.isSafeInteger(revision) || revision < 1) {
    fail('MEMBERSHIP_INVALID', 400);
  }
  const request = await tx.get('SELECT * FROM private__store_requests WHERE id = ? LIMIT 1', id);
  if (!request) fail('MEMBERSHIP_STALE');
  const reference = cleanText(payload?.payment_reference, 120).toUpperCase();
  if (payload?.action === 'approve' && request.status === 'approved') {
    const priorPayment = await tx.get(
      'SELECT reference FROM private__store_payment_log WHERE request_id = ? AND reference = ? LIMIT 1',
      id,
      reference,
    );
    if (priorPayment) return { ok: true, id };
  }
  if (request.status !== 'pending' || Number(request.revision) !== revision) fail('MEMBERSHIP_STALE');
  if (payload?.action === 'reject') {
    await tx.run(
      `UPDATE private__store_requests
          SET status = 'rejected', revision = revision + 1, decided_at = ?, decided_by = ?
        WHERE id = ? AND status = 'pending' AND revision = ?`,
      nowIso,
      adminId,
      id,
      revision,
    );
    return { ok: true, id };
  }
  if (payload?.action !== 'approve') fail('MEMBERSHIP_INVALID', 400);
  if (request.billing_period === 'trial') fail('MEMBERSHIP_TRIAL_DIRECT_ONLY', 400);
  if (payload?.payment_confirmed !== true || reference.length < 6 || reference.length > 120) {
    fail('MEMBERSHIP_PAYMENT_REQUIRED', 400);
  }
  if (await tx.get('SELECT reference FROM private__store_payment_log WHERE reference = ? LIMIT 1', reference)) {
    fail('MEMBERSHIP_PAYMENT_USED', 409);
  }
  const ownerId = request.owner_id;
  if (await activeMembership(tx, ownerId, nowDate.getTime())) fail('MEMBERSHIP_ACTIVE');
  const owner = await tx.get(
    'SELECT id FROM app_users WHERE id = ? AND email_confirmed_at IS NOT NULL AND COALESCE(is_anonymous, 0) = 0 LIMIT 1',
    ownerId,
  );
  if (!owner) fail('MEMBERSHIP_VERIFIED_REQUIRED', 403);
  const slots = await countSlots(tx, ownerId, nowIso);
  if (request.active_limit != null &&
      slots.active + slots.pending > Number(request.active_limit)) {
    fail('MEMBERSHIP_ACTIVE_LIMIT', 409);
  }
  const amount = request.billing_period === 'year'
    ? request.annual_price_try
    : request.monthly_price_try;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) fail('MEMBERSHIP_INVALID', 400);
  const startsAt = nowDate.toISOString();
  const endsAt = request.billing_period === 'year'
    ? addIstanbulCalendarPeriod(nowDate, { years: 1 })
    : addIstanbulCalendarPeriod(nowDate, { months: 1 });
  await insertMemberStore(tx, ownerId, request.store_name, request.description);
  await insertMembership(tx, {
    ownerId,
    requestId: id,
    planName: request.plan_name,
    billingPeriod: request.billing_period,
    trialDays: null,
    monthlyLimit: request.monthly_limit ?? null,
    activeLimit: request.active_limit ?? null,
    startsAt,
    endsAt,
  });
  await tx.run(
    `INSERT INTO private__store_payment_log(reference, request_id, approved_by, amount_try, recorded_at)
     VALUES(?, ?, ?, ?, ?)`,
    reference,
    id,
    adminId,
    Number(amount),
    nowIso,
  );
  await tx.run(
    `UPDATE private__store_requests
        SET status = 'approved', revision = revision + 1, decided_at = ?, decided_by = ?
      WHERE id = ? AND status = 'pending' AND revision = ?`,
    nowIso,
    adminId,
    id,
    revision,
  );
  return { ok: true, id };
}

export async function mutateTursoStoreMembership(database, {
  userId,
  adminId = userId,
  action,
  id,
  revision,
  payload = {},
  now = new Date(),
} = {}) {
  if (!validIdentity(userId)) fail('MEMBERSHIP_VERIFIED_REQUIRED', 403);
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) throw new TypeError('Invalid mutation timestamp.');
  const nowIso = nowDate.toISOString();

  return withImmediateTransaction(database, async tx => {
    if (action === 'request') return requestPlan(tx, userId, id, payload, nowDate.getTime(), nowIso);
    if (action === 'store') return updateStoreProfile(tx, userId, revision, payload, nowDate.getTime());
    if (action === 'trial_start') return startTrial(tx, userId, id, revision, payload, nowDate, nowIso);
    if (action === 'approve' || action === 'reject') {
      if (!validIdentity(adminId)) fail('MEMBERSHIP_ADMIN_REQUIRED', 403);
      return decideRequest(tx, adminId, id, revision, { ...payload, action }, nowDate, nowIso);
    }
    fail('MEMBERSHIP_INVALID', 400);
  });
}
