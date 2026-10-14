const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_SUBMISSION_LIMIT = 10;

function countValue(row) {
  const value = Number(row?.count ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_SUBMISSION_COUNT');
  return value;
}

function countListingSlots(rows, nowMs) {
  return rows.reduce((slots, row) => {
    if (Date.parse(row.expires_at || '') > nowMs) {
      if (row.status === 'approved') slots.active += 1;
      if (row.status === 'pending') slots.pending += 1;
    }
    return slots;
  }, { active: 0, pending: 0 });
}

function emptyQuota() {
  return {
    email_verified: false,
    unlimited: false,
    limit: 0,
    used: 0,
    remaining: 0,
    next_available_at: null,
  };
}

export async function readTursoSubmissionData(database, {
  userId,
  isAdmin = false,
  emailVerified = true,
  now = new Date(),
} = {}) {
  if (typeof userId !== 'string' || !userId) {
    return { quota: emptyQuota(), items: [] };
  }
  if (!emailVerified) {
    return { quota: emptyQuota(), items: [] };
  }

  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const cutoff = new Date(nowMs - DAY_MS).toISOString();
  const membership = await database.get(
    `SELECT plan_name, monthly_limit, active_limit, starts_at, ends_at, billing_period
       FROM private__store_memberships
      WHERE owner_id = ? AND starts_at <= ? AND ends_at > ?
      LIMIT 1`,
    userId,
    nowIso,
    nowIso,
  );
  const slotsRows = membership && membership.active_limit != null
    ? await database.all(
      `SELECT status, expires_at FROM listings
        WHERE submitted_by = ? AND status IN ('approved', 'pending')`,
      userId,
    )
    : [];
  const slots = countListingSlots(slotsRows, nowMs);
  const activeLimit = membership?.active_limit == null ? null : Number(membership.active_limit);
  if (activeLimit !== null && (!Number.isSafeInteger(activeLimit) || activeLimit < 0)) {
    throw new Error('INVALID_ACTIVE_CAPACITY');
  }

  let quota;
  if (isAdmin) {
    quota = {
      email_verified: true,
      unlimited: true,
      limit: null,
      used: 0,
      remaining: null,
      next_available_at: null,
    };
  } else if (membership) {
    const billingPeriod = String(membership.billing_period || '');
    const monthlyLimit = membership.monthly_limit == null ? null : Number(membership.monthly_limit);
    if (billingPeriod === 'month' &&
        (monthlyLimit === null || !Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1)) {
      throw new Error('INVALID_MEMBERSHIP_QUOTA');
    }
    const unlimited = billingPeriod !== 'month';
    const submissionCount = await database.get(
      `SELECT COUNT(*) AS count FROM private__listing_submission_log
        WHERE user_id = ? AND submitted_at >= ? AND submitted_at < ?`,
      userId,
      membership.starts_at,
      membership.ends_at,
    );
    const used = countValue(submissionCount);
    const limit = unlimited ? null : monthlyLimit;
    const remaining = unlimited ? null : Math.max(0, limit - used);
    quota = {
      email_verified: true,
      unlimited,
      limit,
      used,
      remaining,
      next_available_at: null,
      period: billingPeriod === 'year' ? 'membership_year'
        : billingPeriod === 'trial' ? 'membership_trial' : 'membership_month',
      monthly_remaining: remaining,
      active_limit: activeLimit,
      active_used: slots.active,
      pending_reserved: slots.pending,
      plan_name: membership.plan_name,
      membership_ends_at: membership.ends_at,
    };
  } else {
    const submissionCount = await database.get(
      `SELECT COUNT(*) AS count FROM private__listing_submission_log
        WHERE user_id = ? AND submitted_at >= ?`,
      userId,
      cutoff,
    );
    const used = countValue(submissionCount);
    let nextAvailableAt = null;
    if (used >= DAILY_SUBMISSION_LIMIT) {
      const oldest = await database.get(
        `SELECT submitted_at FROM private__listing_submission_log
          WHERE user_id = ? AND submitted_at >= ?
          ORDER BY submitted_at ASC
          LIMIT 1`,
        userId,
        cutoff,
      );
      const oldestMs = Date.parse(oldest?.submitted_at || '');
      if (Number.isFinite(oldestMs)) {
        nextAvailableAt = new Date(oldestMs + DAY_MS).toISOString();
      }
    }
    quota = {
      email_verified: true,
      unlimited: false,
      limit: DAILY_SUBMISSION_LIMIT,
      used,
      remaining: Math.max(0, DAILY_SUBMISSION_LIMIT - used),
      next_available_at: nextAvailableAt,
      period: 'rolling_day',
    };
  }

  if (membership && !isAdmin) {
    const limitReached = quota.remaining === 0;
    const capacityReached = activeLimit !== null && slots.active + slots.pending >= activeLimit;
    quota.can_submit = !limitReached && !capacityReached;
  } else {
    quota.can_submit = isAdmin || quota.remaining > 0;
  }

  const items = await database.all(
    `SELECT id, title, category, status, created_at, expires_at, submitted_by
       FROM listings
      WHERE submitted_by = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 50`,
    userId,
  );
  if (!Array.isArray(items)) throw new Error('INVALID_SUBMISSION_LIST');
  return { quota, items };
}
