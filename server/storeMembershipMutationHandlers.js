import { createTursoConnection } from './turso.js';
import {
  getAuthSession,
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';
import { StoreMembershipMutationError, mutateTursoStoreMembership } from './tursoStoreMembershipMutations.js';

const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_ACTIONS = new Set(['request', 'store', 'trial_start', 'approve', 'reject']);

function resolveSecret(secret, provider) {
  const value = provider ? provider() : (secret ?? getSessionSecret());
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('Session secret is not configured.');
  }
  return value;
}

export function createStoreMembershipMutationHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  mutate = mutateTursoStoreMembership,
  now = () => new Date(),
} = {}) {
  return async function storeMembershipMutationHandler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ message: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return response.status(403).json({ message: 'origin_not_allowed' });
    const enabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled) return response.status(503).json({ message: 'auth_unavailable' });

    let sessionSecret;
    try {
      sessionSecret = resolveSecret(secret, secretProvider);
    } catch {
      return response.status(503).json({ message: 'auth_unavailable' });
    }

    const body = parseJsonBody(request);
    const action = body?.p_action;
    if (!body || !ALLOWED_ACTIONS.has(action)) {
      return response.status(400).json({ message: 'MEMBERSHIP_INVALID' });
    }
    const currentTime = now();
    try {
      const database = connect();
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session?.user?.id) return response.status(401).json({ message: 'MEMBERSHIP_VERIFIED_REQUIRED' });
      const isAdminAction = action === 'approve' || action === 'reject';
      if (isAdminAction && !session.is_admin) {
        return response.status(403).json({ message: 'MEMBERSHIP_ADMIN_REQUIRED' });
      }
      if (isAdminAction) {
        const reauthAt = Date.parse(session.admin_reauth_at || '');
        if (!Number.isFinite(reauthAt) || reauthAt > currentTime.getTime() + 60_000 ||
            currentTime.getTime() - reauthAt > ADMIN_REAUTH_WINDOW_MS) {
          return response.status(403).json({ message: 'MEMBERSHIP_ADMIN_REQUIRED' });
        }
      }

      const result = await mutate(database, {
        userId: session.user.id,
        adminId: session.user.id,
        action,
        id: body.p_id,
        revision: body.p_revision,
        payload: body.p_payload,
        now: currentTime,
      });
      return response.status(200).json(result);
    } catch (error) {
      if (error instanceof StoreMembershipMutationError) {
        const status = Number.isSafeInteger(error.status) ? error.status : 409;
        return response.status(status).json({ message: error.code });
      }
      return response.status(503).json({ message: 'store_membership_unavailable' });
    }
  };
}
