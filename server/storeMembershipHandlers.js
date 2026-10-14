import { createTursoConnection } from './turso.js';
import {
  getAuthSession,
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';
import {
  readTursoStoreMembershipData,
  validStoreId,
} from './tursoMembershipData.js';

const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;

function secretValue(secret, provider) {
  const value = typeof provider === 'function'
    ? provider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

export function createStoreMembershipDataHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  now = () => new Date(),
} = {}) {
  return async function storeMembershipDataHandler(request, response) {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Vary', 'Cookie');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'method_not_allowed' });
    }

    let storeId = null;
    try {
      const url = new URL(request.url || '/', 'https://pazartarla.invalid');
      storeId = url.searchParams.get('store_id');
    } catch {
      return response.status(400).json({ error: 'invalid_store_id' });
    }
    if (storeId !== null && !validStoreId(storeId)) {
      return response.status(400).json({ error: 'invalid_store_id' });
    }

    try {
      const database = connect();
      let session = null;
      const enabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
      if (enabled) {
        const sessionSecret = secretValue(secret, secretProvider);
        if (sessionSecret) session = await getSession(database, request, sessionSecret, now());
      }
      const data = await readTursoStoreMembershipData(database, {
        storeId,
        session,
        now: now(),
      });
      return response.status(200).json(data);
    } catch {
      return response.status(503).json({ error: 'store_membership_unavailable' });
    }
  };
}

export function createStorePublicationHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  now = () => new Date(),
} = {}) {
  return async function storePublicationHandler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return response.status(403).json({ error: 'origin_not_allowed' });
    const enabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled) return response.status(503).json({ error: 'auth_unavailable' });

    let sessionSecret;
    try {
      sessionSecret = secretValue(secret, secretProvider);
    } catch {
      sessionSecret = null;
    }
    if (!sessionSecret) return response.status(503).json({ error: 'auth_unavailable' });

    const body = parseJsonBody(request);
    const storeId = body?.p_id;
    const revision = body?.p_revision;
    const isPublic = body?.p_is_public;
    if (!validStoreId(storeId) || !Number.isSafeInteger(revision) || revision < 1 ||
        typeof isPublic !== 'boolean') {
      return response.status(400).json({ error: 'invalid_store_publication' });
    }

    const currentTime = now();
    try {
      const database = connect();
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session) return response.status(401).json({ error: 'auth_required' });
      if (!session.is_admin) return response.status(403).json({ error: 'admin_required' });
      const reauthAt = Date.parse(session.admin_reauth_at || '');
      if (!Number.isFinite(reauthAt) || reauthAt > currentTime.getTime() + 60_000 ||
          currentTime.getTime() - reauthAt > ADMIN_REAUTH_WINDOW_MS) {
        return response.status(403).json({ error: 'admin_reauthentication_required' });
      }

      const saved = await database.get(
        `UPDATE private__member_stores
            SET is_public = ?,
                revision = revision + CASE WHEN is_public IS NOT ? THEN 1 ELSE 0 END
          WHERE id = ? AND revision = ?
            AND EXISTS (
              SELECT 1 FROM private__store_memberships m
               WHERE m.owner_id = private__member_stores.owner_id
                 AND m.starts_at <= ? AND m.ends_at > ?
            )
          RETURNING is_public, revision`,
        Number(isPublic),
        Number(isPublic),
        storeId.toLowerCase(),
        revision,
        currentTime.toISOString(),
        currentTime.toISOString(),
      );
      if (saved) {
        return response.status(200).json({
          ok: true,
          is_public: Boolean(saved.is_public),
          revision: Number(saved.revision),
        });
      }

      const exists = await database.get(
        'SELECT id FROM private__member_stores WHERE id = ? LIMIT 1',
        storeId.toLowerCase(),
      );
      return exists
        ? response.status(409).json({ error: 'membership_stale' })
        : response.status(404).json({ error: 'store_not_found' });
    } catch {
      return response.status(503).json({ error: 'store_membership_unavailable' });
    }
  };
}
