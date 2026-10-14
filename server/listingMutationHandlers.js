import { createTursoConnection } from './turso.js';
import {
  getAuthSession,
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';
import {
  createTursoListing,
  deleteTursoListing,
  moderateTursoListing,
  readTursoAdminListingForEdit,
  readTursoModerationQueue,
  readTursoOwnerListingForEdit,
  updateTursoListingMedia,
  updateTursoListingFeatured,
  updateTursoOwnerListingArchive,
  updateTursoOwnerListingDetails,
} from './tursoListingMutations.js';

const ADMIN_REAUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSION_BODY_BYTES = 32 * 1024;

function secretValue(secret, provider) {
  const value = typeof provider === 'function'
    ? provider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

function setPrivateJsonHeaders(response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function bodyTooLarge(request) {
  const length = Number(request.headers?.['content-length']);
  if (Number.isFinite(length) && length > MAX_SUBMISSION_BODY_BYTES) return true;
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    try {
      return Buffer.byteLength(JSON.stringify(request.body), 'utf8') > MAX_SUBMISSION_BODY_BYTES;
    } catch {
      return true;
    }
  }
  return Buffer.isBuffer(request.body) &&
    request.body.byteLength > MAX_SUBMISSION_BODY_BYTES;
}

function currentSessionIsAdminReauthenticated(session, now) {
  const reauth = Date.parse(session?.admin_reauth_at || '');
  return session?.is_admin === true && Number.isFinite(reauth) &&
    reauth <= now.getTime() && now.getTime() - reauth <= ADMIN_REAUTH_WINDOW_MS;
}

function safeListingError(error) {
  return typeof error?.code === 'string' && /^LISTING_[A-Z_]+$/.test(error.code)
    ? error.code
    : 'listing_service_unavailable';
}

export function createSubmissionWriteHandler({
  connect = createTursoConnection,
  mutationsEnabled = () => process.env.PAZARTARLA_LISTING_MUTATIONS_BACKEND === 'turso',
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  createListing = createTursoListing,
  now = () => new Date(),
} = {}) {
  return async function submissionWriteHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }
    if (bodyTooLarge(request)) {
      return response.status(413).json({ error: 'LISTING_INVALID' });
    }
    const enabled = typeof mutationsEnabled === 'function'
      ? mutationsEnabled() : mutationsEnabled;
    const authIsEnabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled || !authIsEnabled) {
      return response.status(503).json({ error: 'listing_mutations_unavailable' });
    }

    try {
      const database = connect();
      const currentTime = now();
      const sessionSecret = secretValue(secret, secretProvider);
      if (!sessionSecret) return response.status(503).json({ error: 'auth_unavailable' });
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session?.user?.id) {
        return response.status(401).json({ error: 'LISTING_VERIFIED_ACCOUNT_REQUIRED' });
      }
      const payload = parseJsonBody(request);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        return response.status(400).json({ error: 'LISTING_INVALID' });
      }
      const result = await createListing(database, session, payload, currentTime);
      return response.status(201).json(result);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      return response.status(status).json({ error: safeListingError(error) });
    }
  };
}

export function createListingModerationHandler({
  connect = createTursoConnection,
  mutationsEnabled = () => process.env.PAZARTARLA_LISTING_MUTATIONS_BACKEND === 'turso',
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  readQueue = readTursoModerationQueue,
  moderateListing = moderateTursoListing,
  deleteListing = deleteTursoListing,
  readEditListing = readTursoAdminListingForEdit,
  updateListingMedia = updateTursoListingMedia,
  updateListingFeatured = updateTursoListingFeatured,
  now = () => new Date(),
} = {}) {
  return async function listingModerationHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (request.method === 'POST' && !isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }
    if (request.method === 'POST' && bodyTooLarge(request)) {
      return response.status(413).json({ error: 'LISTING_INVALID' });
    }
    const enabled = typeof mutationsEnabled === 'function'
      ? mutationsEnabled() : mutationsEnabled;
    const authIsEnabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled || !authIsEnabled) {
      return response.status(503).json({ error: 'listing_mutations_unavailable' });
    }

    try {
      const database = connect();
      const currentTime = now();
      const sessionSecret = secretValue(secret, secretProvider);
      if (!sessionSecret) return response.status(503).json({ error: 'auth_unavailable' });
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session?.user?.id || session.is_admin !== true) {
        return response.status(403).json({ error: 'LISTING_ADMIN_REQUIRED' });
      }
      if (!currentSessionIsAdminReauthenticated(session, currentTime)) {
        return response.status(403).json({ error: 'LISTING_ADMIN_REAUTH_REQUIRED' });
      }
      if (request.method === 'GET') {
        if (request.query?.id !== undefined) {
          return response.status(200).json(await readEditListing(
            database, session, request.query.id, currentTime,
          ));
        }
        return response.status(200).json(await readQueue(database, currentTime));
      }
      const payload = parseJsonBody(request);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        return response.status(400).json({ error: 'LISTING_INVALID' });
      }
      if (payload.decision === 'delete') {
        return response.status(200).json(
          await deleteListing(database, session, payload.id, currentTime),
        );
      }
      if (payload.decision === 'edit_media') {
        return response.status(200).json(await updateListingMedia(
          database, session, payload.id, payload.edit_token, payload.changes, currentTime,
        ));
      }
      if (payload.decision === 'set_featured') {
        return response.status(200).json(await updateListingFeatured(
          database, session, payload.id, payload.edit_token, payload.featured, currentTime,
        ));
      }
      const result = await moderateListing(
        database,
        session,
        payload.id,
        payload.decision,
        payload.edit_token,
        currentTime,
      );
      return response.status(200).json(result);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      return response.status(status).json({ error: safeListingError(error) });
    }
  };
}

export function createOwnerListingHandler({
  connect = createTursoConnection,
  mutationsEnabled = () => process.env.PAZARTARLA_LISTING_MUTATIONS_BACKEND === 'turso',
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  getSession = getAuthSession,
  readListing = readTursoOwnerListingForEdit,
  updateListing = updateTursoOwnerListingDetails,
  updateArchive = updateTursoOwnerListingArchive,
  now = () => new Date(),
} = {}) {
  return async function ownerListingHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (request.method === 'POST' && !isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }
    if (request.method === 'POST' && bodyTooLarge(request)) {
      return response.status(413).json({ error: 'LISTING_INVALID' });
    }
    const enabled = typeof mutationsEnabled === 'function'
      ? mutationsEnabled() : mutationsEnabled;
    const authIsEnabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled || !authIsEnabled) {
      return response.status(503).json({ error: 'listing_mutations_unavailable' });
    }
    try {
      const database = connect();
      const currentTime = now();
      const sessionSecret = secretValue(secret, secretProvider);
      if (!sessionSecret) return response.status(503).json({ error: 'auth_unavailable' });
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session?.user?.id) {
        return response.status(401).json({ error: 'LISTING_VERIFIED_ACCOUNT_REQUIRED' });
      }
      if (request.method === 'GET') {
        if (request.query?.id === undefined) {
          return response.status(400).json({ error: 'LISTING_INVALID' });
        }
        return response.status(200).json(await readListing(
          database, session, request.query.id, currentTime,
        ));
      }
      const payload = parseJsonBody(request);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        return response.status(400).json({ error: 'LISTING_INVALID' });
      }
      let result;
      if (payload.action === 'edit') {
        result = await updateListing(
          database, session, payload.id, payload.changes, payload.edit_token, currentTime,
        );
      } else if (payload.action === 'archive' || payload.action === 'restore') {
        result = await updateArchive(
          database, session, payload.id, payload.edit_token, payload.action, currentTime,
        );
      } else {
        return response.status(400).json({ error: 'LISTING_INVALID' });
      }
      return response.status(200).json(result);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      return response.status(status).json({ error: safeListingError(error) });
    }
  };
}
