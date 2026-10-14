import { createTursoConnection } from './turso.js';
import {
  getAuthSession,
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';
import { mutateTursoOffer, readTursoOfferData } from './tursoOffers.js';

function secretValue(secret, provider) {
  const value = typeof provider === 'function'
    ? provider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

function headers(response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

export function createOfferHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  readOffers = readTursoOfferData,
  mutateOffer = mutateTursoOffer,
  now = () => new Date(),
} = {}) {
  return async function offerHandler(request, response) {
    headers(response);
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (request.method === 'POST' && !isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }

    try {
      const database = connect();
      const enabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
      let session = null;
      if (enabled) {
        const sessionSecret = secretValue(secret, secretProvider);
        if (!sessionSecret) {
          return response.status(503).json({ error: 'auth_unavailable' });
        }
        session = await getSession(database, request, sessionSecret, now());
      }

      if (request.method === 'GET') {
        const data = await readOffers(database, {
          userId: session?.user?.id || null,
          now: now(),
        });
        return response.status(200).json(data);
      }

      if (!enabled) return response.status(503).json({ error: 'auth_unavailable' });
      if (!session?.user?.id) return response.status(401).json({ error: 'OFFER_LOGIN_REQUIRED' });
      const result = await mutateOffer(database, session.user.id, parseJsonBody(request), now());
      return response.status(200).json({ ok: true, result: result ?? null });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      const code = typeof error?.code === 'string' && /^OFFER_[A-Z_]+$/.test(error.code)
        ? error.code
        : 'offer_service_unavailable';
      return response.status(status).json({ error: code });
    }
  };
}
