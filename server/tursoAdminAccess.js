import { createTursoConnection } from './turso.js';
import { getAuthSession, getSessionSecret } from './tursoAuth.js';

export const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;

export function setPrivateJsonHeaders(response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

export function resolveSessionSecret(secretProvider) {
  const value = typeof secretProvider === 'function' ? secretProvider() : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32 ? value : null;
}

export function isFreshAdminSession(session, now) {
  const reauth = Date.parse(session?.admin_reauth_at || '');
  return session?.is_admin === true && Boolean(session?.user?.id) &&
    Number.isFinite(reauth) && reauth <= now.getTime() &&
    now.getTime() - reauth <= ADMIN_REAUTH_WINDOW_MS;
}

export async function authenticateTursoAdmin(request, {
  connect = createTursoConnection,
  secretProvider,
  getSession = getAuthSession,
  now = () => new Date(),
} = {}) {
  if (process.env.PAZARTARLA_AUTH_BACKEND !== 'turso') {
    return { status: 503, error: 'auth_unavailable' };
  }
  const secret = resolveSessionSecret(secretProvider);
  if (!secret) return { status: 503, error: 'auth_unavailable' };
  const currentTime = now();
  const database = connect();
  const session = await getSession(database, request, secret, currentTime);
  if (!session?.user?.id || session.is_admin !== true) {
    return { status: 403, error: 'LISTING_ADMIN_REQUIRED' };
  }
  if (!isFreshAdminSession(session, currentTime)) {
    return { status: 403, error: 'LISTING_ADMIN_REAUTH_REQUIRED' };
  }
  return { database, session, currentTime };
}
