import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import bcrypt from 'bcryptjs';
import { normalizeAuthEmail } from './tursoAuth.js';

const ACTION_TTL_SECONDS = {
  email_verification: 24 * 60 * 60,
  password_reset: 60 * 60,
};
const RATE_WINDOW_SECONDS = 60 * 60;
const MAX_PASSWORD_BYTES = 72;

export class AuthFlowError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'AuthFlowError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new AuthFlowError(code, status);
}

function validEmail(value) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanPassword(value) {
  return typeof value === 'string' ? value : '';
}

function validToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex');
}

function subjectDigest(secret, action, scope, subject) {
  return createHmac('sha256', secret)
    .update(`auth-action:${action}:${scope}:${subject}`)
    .digest('hex');
}

function requestIp(request) {
  const proxyAddress = String(request?.headers?.['x-real-ip'] || '').trim();
  if (isIP(proxyAddress)) return proxyAddress;
  const socketAddress = String(request?.socket?.remoteAddress || '').trim();
  return isIP(socketAddress) ? socketAddress : 'unknown';
}

async function withImmediateTransaction(database, callback) {
  if (typeof database?.transactionAsync !== 'function') {
    throw new Error('Turso transaction support is required for account flows.');
  }
  const transaction = database.transactionAsync(callback);
  if (typeof transaction?.immediate !== 'function') {
    throw new Error('Turso immediate transactions are unavailable.');
  }
  return transaction.immediate();
}

async function consumeLimit(tx, secret, action, scope, subject, nowSeconds, maxAttempts) {
  const hash = subjectDigest(secret, action, scope, subject);
  const cutoff = nowSeconds - RATE_WINDOW_SECONDS;
  await tx.run(
    `INSERT INTO auth_action_limits(action, subject_hash, window_started_at, attempts)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(action, subject_hash) DO UPDATE SET
       attempts = CASE
         WHEN auth_action_limits.window_started_at <= ? THEN 1
         ELSE auth_action_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN auth_action_limits.window_started_at <= ? THEN excluded.window_started_at
         ELSE auth_action_limits.window_started_at
       END`,
    action,
    hash,
    nowSeconds,
    cutoff,
    cutoff,
  );
  const row = await tx.get(
    'SELECT attempts FROM auth_action_limits WHERE action = ? AND subject_hash = ?',
    action,
    hash,
  );
  return Number(row?.attempts || 0) > maxAttempts;
}

async function pruneExpiredAuthRows(tx, nowDate) {
  const nowIso = nowDate.toISOString();
  const limitCutoff = Math.floor(nowDate.getTime() / 1000) - 30 * 24 * 60 * 60;
  await tx.run(
    'DELETE FROM auth_action_tokens WHERE consumed_at IS NOT NULL OR expires_at <= ?',
    nowIso,
  );
  await tx.run(
    'DELETE FROM auth_action_limits WHERE window_started_at < ?',
    limitCutoff,
  );
}

async function issueActionToken(tx, userId, purpose, nowDate) {
  const nowIso = nowDate.toISOString();
  const expiresAt = new Date(
    nowDate.getTime() + ACTION_TTL_SECONDS[purpose] * 1000,
  ).toISOString();
  await tx.run(
    `UPDATE auth_action_tokens SET consumed_at = ?
      WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL`,
    nowIso,
    userId,
    purpose,
  );
  const token = randomBytes(32).toString('base64url');
  await tx.run(
    `INSERT INTO auth_action_tokens(token_hash, user_id, purpose, created_at, expires_at, consumed_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    tokenDigest(token),
    userId,
    purpose,
    nowIso,
    expiresAt,
  );
  return token;
}

function actionDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid auth-flow timestamp.');
  return date;
}

export async function createTursoSignup(database, {
  email,
  password,
  request,
  secret,
  now = new Date(),
} = {}) {
  const normalizedEmail = normalizeAuthEmail(email);
  const cleanPass = cleanPassword(password);
  if (!validEmail(normalizedEmail) ||
      Buffer.byteLength(cleanPass, 'utf8') < 8 ||
      Buffer.byteLength(cleanPass, 'utf8') > MAX_PASSWORD_BYTES) {
    fail('AUTH_INVALID_SIGNUP', 400);
  }
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    fail('AUTH_UNAVAILABLE', 503);
  }
  const nowDate = actionDate(now);
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  const ip = requestIp(request);
  const eligibility = await withImmediateTransaction(database, async tx => {
    await pruneExpiredAuthRows(tx, nowDate);
    const ipLimited = await consumeLimit(tx, secret, 'signup', 'ip', ip, nowSeconds, 12);
    const emailLimited = await consumeLimit(tx, secret, 'signup', 'email', normalizedEmail, nowSeconds, 4);
    const existing = await tx.get(
      'SELECT id FROM app_users WHERE email = ? LIMIT 1',
      normalizedEmail,
    );
    return { ipLimited, emailLimited, exists: Boolean(existing) };
  });
  if (eligibility.ipLimited) fail('AUTH_TOO_MANY_ATTEMPTS', 429);
  if (eligibility.emailLimited || eligibility.exists) return { accepted: true, mail: null };

  const passwordHash = await bcrypt.hash(cleanPass, 12);
  return withImmediateTransaction(database, async tx => {
    const existing = await tx.get(
      'SELECT id FROM app_users WHERE email = ? LIMIT 1',
      normalizedEmail,
    );
    if (existing) return { accepted: true, mail: null };

    const userId = randomUUID();
    const nowIso = nowDate.toISOString();
    await tx.run(
      `INSERT INTO app_users(
        id, email, password_hash, email_confirmed_at, created_at, updated_at,
        banned_until, deleted_at, is_anonymous
      ) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, 0)`,
      userId,
      normalizedEmail,
      passwordHash,
      nowIso,
      nowIso,
    );
    const token = await issueActionToken(tx, userId, 'email_verification', nowDate);
    return {
      accepted: true,
      mail: { email: normalizedEmail, purpose: 'email_verification', token },
    };
  });
}

async function issueForEmail(database, emailValue, purpose, {
  request,
  secret,
  now = new Date(),
} = {}) {
  const email = normalizeAuthEmail(emailValue);
  if (!validEmail(email)) fail('AUTH_INVALID_EMAIL', 400);
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    fail('AUTH_UNAVAILABLE', 503);
  }
  const nowDate = actionDate(now);
  const nowIso = nowDate.toISOString();
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  const action = purpose === 'email_verification'
    ? 'resend_verification'
    : 'request_password_reset';
  const ip = requestIp(request);
  return withImmediateTransaction(database, async tx => {
    await pruneExpiredAuthRows(tx, nowDate);
    const ipLimited = await consumeLimit(tx, secret, action, 'ip', ip, nowSeconds, 12);
    const emailLimited = await consumeLimit(tx, secret, action, 'email', email, nowSeconds, 4);
    if (ipLimited) fail('AUTH_TOO_MANY_ATTEMPTS', 429);
    if (emailLimited) return { accepted: true, mail: null };

    const user = await tx.get(
      `SELECT id FROM app_users
        WHERE email = ? AND email_confirmed_at IS NULL
          AND deleted_at IS NULL AND COALESCE(is_anonymous, 0) = 0
        LIMIT 1`,
      email,
    );
    if (purpose === 'password_reset') {
      const verified = await tx.get(
        `SELECT id FROM app_users
          WHERE email = ? AND email_confirmed_at IS NOT NULL
            AND deleted_at IS NULL AND COALESCE(is_anonymous, 0) = 0
          LIMIT 1`,
        email,
      );
      if (!verified) return { accepted: true, mail: null };
      const token = await issueActionToken(tx, verified.id, purpose, nowDate);
      return { accepted: true, mail: { email, purpose, token } };
    }
    if (!user) return { accepted: true, mail: null };
    const token = await issueActionToken(tx, user.id, purpose, nowDate);
    return { accepted: true, mail: { email, purpose, token } };
  });
}

export function resendTursoVerification(database, email, options = {}) {
  return issueForEmail(database, email, 'email_verification', options);
}

export function requestTursoPasswordReset(database, email, options = {}) {
  return issueForEmail(database, email, 'password_reset', options);
}

export async function verifyTursoEmail(database, token, {
  request,
  secret,
  now = new Date(),
} = {}) {
  if (!validToken(token)) fail('AUTH_ACTION_TOKEN_INVALID', 400);
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    fail('AUTH_UNAVAILABLE', 503);
  }
  const nowDate = actionDate(now);
  const nowIso = nowDate.toISOString();
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  const ip = requestIp(request);
  const hash = tokenDigest(token);
  return withImmediateTransaction(database, async tx => {
    await pruneExpiredAuthRows(tx, nowDate);
    const ipLimited = await consumeLimit(tx, secret, 'verify_email', 'ip', ip, nowSeconds, 20);
    const tokenLimited = await consumeLimit(tx, secret, 'verify_email', 'token', hash, nowSeconds, 6);
    if (ipLimited || tokenLimited) fail('AUTH_TOO_MANY_ATTEMPTS', 429);
    const action = await tx.get(
      `SELECT user_id FROM auth_action_tokens
        WHERE token_hash = ? AND purpose = 'email_verification'
          AND consumed_at IS NULL AND expires_at > ?
        LIMIT 1`,
      hash,
      nowIso,
    );
    if (!action) fail('AUTH_ACTION_TOKEN_INVALID', 400);
    const user = await tx.get(
      `SELECT id FROM app_users
        WHERE id = ? AND deleted_at IS NULL AND COALESCE(is_anonymous, 0) = 0
        LIMIT 1`,
      action.user_id,
    );
    if (!user) fail('AUTH_ACTION_TOKEN_INVALID', 400);
    await tx.run(
      'UPDATE app_users SET email_confirmed_at = COALESCE(email_confirmed_at, ?), updated_at = ? WHERE id = ?',
      nowIso,
      nowIso,
      user.id,
    );
    await tx.run(
      'UPDATE auth_action_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL',
      nowIso,
      hash,
    );
    return { ok: true };
  });
}

async function findValidResetToken(database, token, { request, secret, nowDate }) {
  const nowIso = nowDate.toISOString();
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  const ip = requestIp(request);
  const hash = tokenDigest(token);
  return withImmediateTransaction(database, async tx => {
    await pruneExpiredAuthRows(tx, nowDate);
    const ipLimited = await consumeLimit(tx, secret, 'reset_password', 'ip', ip, nowSeconds, 12);
    const tokenLimited = await consumeLimit(tx, secret, 'reset_password', 'token', hash, nowSeconds, 6);
    if (ipLimited || tokenLimited) fail('AUTH_TOO_MANY_ATTEMPTS', 429);
    const action = await tx.get(
      `SELECT user_id FROM auth_action_tokens
        WHERE token_hash = ? AND purpose = 'password_reset'
          AND consumed_at IS NULL AND expires_at > ?
        LIMIT 1`,
      hash,
      nowIso,
    );
    if (!action) fail('AUTH_ACTION_TOKEN_INVALID', 400);
    return action.user_id;
  });
}

export async function resetTursoPassword(database, token, password, {
  request,
  secret,
  now = new Date(),
} = {}) {
  const cleanPass = cleanPassword(password);
  if (!validToken(token) ||
      Buffer.byteLength(cleanPass, 'utf8') < 8 ||
      Buffer.byteLength(cleanPass, 'utf8') > MAX_PASSWORD_BYTES) {
    fail('AUTH_INVALID_PASSWORD_RESET', 400);
  }
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    fail('AUTH_UNAVAILABLE', 503);
  }
  const nowDate = actionDate(now);
  const userId = await findValidResetToken(database, token, { request, secret, nowDate });
  const passwordHash = await bcrypt.hash(cleanPass, 12);
  const nowIso = nowDate.toISOString();
  const hash = tokenDigest(token);
  return withImmediateTransaction(database, async tx => {
    const action = await tx.get(
      `SELECT user_id FROM auth_action_tokens
        WHERE token_hash = ? AND user_id = ? AND purpose = 'password_reset'
          AND consumed_at IS NULL AND expires_at > ?
        LIMIT 1`,
      hash,
      userId,
      nowIso,
    );
    if (!action) fail('AUTH_ACTION_TOKEN_INVALID', 400);
    await tx.run(
      'UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ?',
      passwordHash,
      nowIso,
      userId,
    );
    await tx.run(
      `UPDATE auth_action_tokens SET consumed_at = ?
        WHERE user_id = ? AND purpose = 'password_reset' AND consumed_at IS NULL`,
      nowIso,
      userId,
    );
    await tx.run('DELETE FROM auth_sessions WHERE user_id = ?', userId);
    return { ok: true };
  });
}
