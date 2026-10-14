import { createTursoConnection } from './turso.js';
import {
  beginAuthLogin,
  clearSessionCookie,
  getAuthSession,
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
  revokeAuthSession,
} from './tursoAuth.js';

function setHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function send(response, status, body) {
  return response.status(status).json(body);
}

function isEnabled(enabled) {
  return typeof enabled === 'function' ? enabled() : enabled;
}

function resolveSecret(secret, secretProvider) {
  const value = typeof secretProvider === 'function'
    ? secretProvider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

function unavailable(response) {
  return send(response, 503, { error: 'auth_unavailable' });
}

function createLoginHandler({ connect = createTursoConnection, enabled = () =>
  process.env.PAZARTARLA_AUTH_BACKEND === 'turso', secret, secretProvider = null,
now = () => new Date(), adminOnly = false } = {}) {
  return async function authLoginHandler(request, response) {
    setHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return send(response, 405, { error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return send(response, 403, { error: 'origin_not_allowed' });
    if (!isEnabled(enabled)) return unavailable(response);
    const sessionSecret = resolveSecret(secret, secretProvider);
    if (!sessionSecret) return unavailable(response);
    const body = parseJsonBody(request);
    if (!body || typeof body !== 'object') {
      return send(response, 400, { error: 'invalid_request' });
    }
    try {
      const database = connect();
      const result = await beginAuthLogin(database, request, response, body, {
        secret: sessionSecret,
        now: now(),
        adminOnly,
      });
      return send(response, result.status, result.body);
    } catch {
      return unavailable(response);
    }
  };
}

export const createAuthLoginHandler = options =>
  createLoginHandler({ ...options, adminOnly: false });

export const createAdminLoginHandler = options =>
  createLoginHandler({ ...options, adminOnly: true });

export function createAuthSessionHandler({
  connect = createTursoConnection,
  enabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  now = () => new Date(),
} = {}) {
  return async function authSessionHandler(request, response) {
    setHeaders(response);
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return send(response, 405, { error: 'method_not_allowed' });
    }
    if (!isEnabled(enabled)) return unavailable(response);
    const sessionSecret = resolveSecret(secret, secretProvider);
    if (!sessionSecret) return unavailable(response);
    try {
      const session = await getAuthSession(connect(), request, sessionSecret, now());
      return send(response, 200, {
        user: session?.user ?? null,
        expires_at: session?.expires_at ?? null,
        is_admin: session?.is_admin ?? false,
        admin_reauth_at: session?.admin_reauth_at ?? null,
      });
    } catch {
      return unavailable(response);
    }
  };
}

export function createAuthLogoutHandler({
  connect = createTursoConnection,
  enabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
} = {}) {
  return async function authLogoutHandler(request, response) {
    setHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return send(response, 405, { error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return send(response, 403, { error: 'origin_not_allowed' });
    if (!isEnabled(enabled)) return unavailable(response);
    const sessionSecret = resolveSecret(secret, secretProvider);
    if (!sessionSecret) return unavailable(response);
    try {
      const database = connect();
      await revokeAuthSession(database, request, sessionSecret);
      clearSessionCookie(response);
      return send(response, 200, { ok: true });
    } catch {
      return unavailable(response);
    }
  };
}
