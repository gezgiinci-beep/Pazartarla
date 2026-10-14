import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 10;
const PROD_COOKIE = '__Host-pazartarla_session';
const DEV_COOKIE = 'pazartarla_session';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-login-timing-probe', 10);

export function normalizeAuthEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET;
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32
    ? secret
    : null;
}

function hmac(value, secret, purpose) {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex');
}

function requestIsSecure(request) {
  const forwarded = String(request.headers?.['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  if (forwarded === 'https') return true;
  if (forwarded === 'http') return false;
  return Boolean(request.socket?.encrypted);
}

function cookieName(request) {
  return requestIsSecure(request) ? PROD_COOKIE : DEV_COOKIE;
}

function readCookies(header) {
  const cookies = new Map();
  for (const part of String(header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && value) cookies.set(name, value);
  }
  return cookies;
}

function rawSessionToken(request) {
  const cookies = readCookies(request.headers?.cookie);
  const secure = requestIsSecure(request);
  const value = secure
    ? cookies.get(PROD_COOKIE)
    : cookies.get(DEV_COOKIE) || cookies.get(PROD_COOKIE);
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : null;
}

export function setSessionCookie(response, request, token) {
  const secure = requestIsSecure(request);
  const name = cookieName(request);
  const flags = [
    `${name}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_SECONDS}`,
  ];
  if (secure) flags.push('Secure');
  response.setHeader('Set-Cookie', flags.join('; '));
}

export function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', [
    `${PROD_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${DEV_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ]);
}

export function isSameOrigin(request) {
  const origin = request.headers?.origin;
  const host = String(request.headers?.['x-forwarded-host'] || request.headers?.host || '')
    .split(',')[0].trim().toLowerCase();
  if (typeof origin !== 'string' || !host) return false;
  try {
    const parsed = new URL(origin);
    const forwardedProtocol = String(request.headers?.['x-forwarded-proto'] || '')
      .split(',')[0].trim().toLowerCase();
    const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http'
      ? forwardedProtocol
      : request.socket?.encrypted ? 'https' : 'http';
    return parsed.host.toLowerCase() === host && parsed.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body !== 'string' && !Buffer.isBuffer(request.body)) return null;
  try {
    return JSON.parse(String(request.body));
  } catch {
    return null;
  }
}

export async function verifyAuthPassword(database, emailValue, password, now = new Date()) {
  const email = normalizeAuthEmail(emailValue);
  const user = await database.get(
    `SELECT id, email, password_hash, email_confirmed_at, banned_until,
            deleted_at, is_anonymous
       FROM app_users
      WHERE email = ?
      LIMIT 1`,
    email,
  );
  const hash = typeof user?.password_hash === 'string'
    ? user.password_hash
    : DUMMY_PASSWORD_HASH;
  let matches = false;
  try {
    matches = await bcrypt.compare(password, hash);
  } catch {
    matches = false;
  }
  if (!user || !matches || user.deleted_at || Number(user.is_anonymous) === 1) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (user.banned_until && Date.parse(user.banned_until) > now.getTime()) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (!user.email_confirmed_at) {
    return { ok: false, reason: 'email_verification_required' };
  }
  return { ok: true, user };
}

async function consumeLoginAttempt(database, email, secret, now) {
  const subjectHash = hmac(email, secret, 'login-email');
  const seconds = Math.floor(now.getTime() / 1000);
  const cutoff = seconds - LOGIN_WINDOW_SECONDS;
  await database.run(
    `INSERT INTO auth_login_limits (subject_hash, window_started_at, attempts)
     VALUES (?, ?, 1)
     ON CONFLICT(subject_hash) DO UPDATE SET
       attempts = CASE
         WHEN auth_login_limits.window_started_at <= ? THEN 1
         ELSE auth_login_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN auth_login_limits.window_started_at <= ? THEN excluded.window_started_at
         ELSE auth_login_limits.window_started_at
       END`,
    subjectHash,
    seconds,
    cutoff,
    cutoff,
  );
  const limit = await database.get(
    'SELECT attempts FROM auth_login_limits WHERE subject_hash = ?',
    subjectHash,
  );
  return Number(limit?.attempts || 0) > MAX_LOGIN_ATTEMPTS;
}

async function clearLoginAttempts(database, email, secret) {
  const subjectHash = hmac(email, secret, 'login-email');
  await database.run(
    'DELETE FROM auth_login_limits WHERE subject_hash = ?',
    subjectHash,
  );
}

export async function createAuthSession(database, user, secret, now = new Date(), isAdminLogin = false) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hmac(token, secret, 'session-token');
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await database.run(
    `INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, admin_reauth_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token_hash) DO NOTHING`,
    tokenHash,
    user.id,
    createdAt,
    expiresAt,
    isAdminLogin ? createdAt : null,
  );
  await database.run(
    'DELETE FROM auth_sessions WHERE expires_at <= ?',
    createdAt,
  );
  return { token, expiresAt };
}

export async function getAuthSession(database, request, secret, now = new Date()) {
  const token = rawSessionToken(request);
  if (!token) return null;
  const tokenHash = hmac(token, secret, 'session-token');
  const currentTime = now.toISOString();
  const row = await database.get(
    `SELECT s.user_id, s.expires_at, s.admin_reauth_at,
            u.email, u.email_confirmed_at, u.banned_until, u.deleted_at, u.is_anonymous
       FROM auth_sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
      LIMIT 1`,
    tokenHash,
    currentTime,
  );
  if (!row || row.deleted_at || Number(row.is_anonymous) === 1 ||
      !row.email_confirmed_at ||
      (row.banned_until && Date.parse(row.banned_until) > now.getTime())) return null;

  const admin = await database.get(
    `SELECT 1 AS allowed FROM private__listing_admins
      WHERE lower(trim(email)) = ? LIMIT 1`,
    normalizeAuthEmail(row.email),
  );
  return {
    user: {
      id: row.user_id,
      email: normalizeAuthEmail(row.email),
      email_confirmed_at: row.email_confirmed_at,
      is_anonymous: false,
    },
    expires_at: row.expires_at,
    is_admin: Boolean(admin),
    admin_reauth_at: row.admin_reauth_at ?? null,
  };
}

export async function revokeAuthSession(database, request, secret) {
  const token = rawSessionToken(request);
  if (!token) return;
  await database.run(
    'DELETE FROM auth_sessions WHERE token_hash = ?',
    hmac(token, secret, 'session-token'),
  );
}

export async function beginAuthLogin(database, request, response, body, {
  secret,
  now = new Date(),
  adminOnly = false,
} = {}) {
  const email = normalizeAuthEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !password || Buffer.byteLength(password, 'utf8') > 72) {
    return { status: 401, body: { error: 'invalid_credentials' } };
  }
  if (await consumeLoginAttempt(database, email, secret, now)) {
    return { status: 429, body: { error: 'too_many_attempts' } };
  }

  const result = await verifyAuthPassword(database, email, password, now);
  if (!result.ok) {
    if (result.reason === 'email_verification_required') {
      return { status: 403, body: { error: 'email_verification_required' } };
    }
    return { status: 401, body: { error: 'invalid_credentials' } };
  }
  const user = result.user;
  const admin = await database.get(
    `SELECT 1 AS allowed FROM private__listing_admins
      WHERE lower(trim(email)) = ? LIMIT 1`,
    email,
  );
  if (adminOnly && !admin) {
    return { status: 401, body: { error: 'invalid_credentials' } };
  }

  await revokeAuthSession(database, request, secret);
  const session = await createAuthSession(database, user, secret, now, Boolean(adminOnly));
  await clearLoginAttempts(database, email, secret);
  setSessionCookie(response, request, session.token);
  return {
    status: 200,
    body: {
      user: {
        id: user.id,
        email,
        email_confirmed_at: user.email_confirmed_at,
      },
      expires_at: session.expiresAt,
      is_admin: Boolean(admin),
      admin_login: Boolean(adminOnly),
    },
  };
}
