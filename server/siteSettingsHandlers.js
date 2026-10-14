import { createTursoConnection } from './turso.js';
import {
  getSessionSecret,
  getAuthSession,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';
import {
  readTursoSiteSettings,
  updateTursoSiteSettings,
} from './tursoSiteSettings.js';
import { retryAfterDelayMs } from '../src/lib/publicReadResilience.mjs';

const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;

function setHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function send(response, status, body) {
  return response.status(status).json(body);
}

function sendUnavailable(response, error, code) {
  const upstreamStatus = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (upstreamStatus === 402 || upstreamStatus === 429) {
    const retryAfterMs = Number(error?.retryAfterMs) ||
      retryAfterDelayMs(error?.headers ?? error?.response?.headers) || 300_000;
    response.setHeader('Retry-After', String(Math.max(1, Math.ceil(Math.min(60 * 60_000, retryAfterMs) / 1000))));
    return send(response, upstreamStatus, { error: code });
  }
  return send(response, 503, { error: code });
}

function authIsEnabled(value) {
  return typeof value === 'function' ? value() : value;
}

function secretValue(secret, provider) {
  const value = typeof provider === 'function'
    ? provider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

function recentAdminReauthentication(session, now) {
  const timestamp = Date.parse(session?.admin_reauth_at || '');
  return Number.isFinite(timestamp) &&
    timestamp <= now.getTime() + 60_000 &&
    now.getTime() - timestamp <= ADMIN_REAUTH_WINDOW_MS;
}

export function createSiteSettingsHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  now = () => new Date(),
} = {}) {
  return async function siteSettingsHandler(request, response) {
    setHeaders(response);
    if (request.method === 'GET') {
      try {
        const settings = await readTursoSiteSettings(connect());
        if (settings) {
          response.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600');
          response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600');
        }
        return settings
          ? send(response, 200, { settings })
          : send(response, 404, { error: 'settings_not_found' });
      } catch (error) {
        return sendUnavailable(response, error, 'settings_unavailable');
      }
    }
    if (request.method !== 'PATCH') {
      response.setHeader('Allow', 'GET, PATCH');
      return send(response, 405, { error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return send(response, 403, { error: 'origin_not_allowed' });
    if (!authIsEnabled(authEnabled)) return send(response, 503, { error: 'auth_unavailable' });
    const sessionSecret = secretValue(secret, secretProvider);
    if (!sessionSecret) return send(response, 503, { error: 'auth_unavailable' });

    const body = parseJsonBody(request);
    if (!body || typeof body !== 'object' || !Number.isSafeInteger(body.revision) ||
        !body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) {
      return send(response, 400, { error: 'invalid_settings_patch' });
    }

    const currentTime = now();
    try {
      const database = connect();
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session) return send(response, 401, { error: 'auth_required' });
      if (!session.is_admin) return send(response, 403, { error: 'admin_required' });
      if (!recentAdminReauthentication(session, currentTime)) {
        return send(response, 403, { error: 'admin_reauthentication_required' });
      }
      const settings = await updateTursoSiteSettings(
        database,
        body.revision,
        body.patch,
      );
      return send(response, 200, { settings });
    } catch (error) {
      if (error?.code === 'INVALID_SITE_SETTINGS_PATCH') {
        return send(response, 400, { error: 'invalid_settings_patch' });
      }
      if (error?.code === 'SITE_SETTINGS_REVISION_CONFLICT') {
        return send(response, 409, { error: 'settings_conflict' });
      }
      if (error?.code === 'SITE_SETTINGS_NOT_FOUND') {
        return send(response, 404, { error: 'settings_not_found' });
      }
      return sendUnavailable(response, error, 'settings_unavailable');
    }
  };
}
