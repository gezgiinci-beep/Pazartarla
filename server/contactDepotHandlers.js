import { createTursoConnection } from './turso.js';
import { isSameOrigin, parseJsonBody } from './tursoAuth.js';
import { authenticateTursoAdmin, setPrivateJsonHeaders } from './tursoAdminAccess.js';
import {
  mutateTursoContactDepot,
  readTursoContactDepot,
  unsubscribeTursoContact,
} from './tursoContactDepot.js';

const MAX_BODY_BYTES = 175_000;

function requestBodyTooLarge(request) {
  const length = Number(request.headers?.['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return true;
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    try {
      return Buffer.byteLength(JSON.stringify(request.body), 'utf8') > MAX_BODY_BYTES;
    } catch {
      return true;
    }
  }
  return Buffer.isBuffer(request.body) && request.body.byteLength > MAX_BODY_BYTES;
}

function contactErrorResponse(error) {
  if (typeof error?.code === 'string' && /^CONTACT_[A-Z_]+$/.test(error.code)) {
    return { status: Number.isInteger(error.status) ? error.status : 400, error: error.code };
  }
  if (String(error?.message || '').includes('no such table')) {
    return { status: 503, error: 'CONTACT_UNAVAILABLE' };
  }
  return { status: 503, error: 'CONTACT_UNAVAILABLE' };
}

export function createTursoContactDepotHandler({
  connect = createTursoConnection,
  authenticate = authenticateTursoAdmin,
  readPage = readTursoContactDepot,
  mutate = mutateTursoContactDepot,
  now = () => new Date(),
} = {}) {
  return async function tursoContactDepotHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }
    if (request.method === 'POST' && requestBodyTooLarge(request)) {
      return response.status(413).json({ error: 'CONTACT_IMPORT_SIZE' });
    }
    try {
      const access = await authenticate(request, { connect, now });
      if (access.status) return response.status(access.status).json({ error: access.error });
      const currentTime = access.currentTime || now();
      if (request.method === 'GET') {
        const page = await readPage(access.database, {
          search: typeof request.query?.search === 'string' ? request.query.search : '',
          page: Number(request.query?.page ?? 0),
          archived: request.query?.archived === 'true',
        });
        return response.status(200).json(page);
      }
      const payload = parseJsonBody(request);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
          typeof payload.operation !== 'string' || !payload.args ||
          typeof payload.args !== 'object' || Array.isArray(payload.args)) {
        return response.status(400).json({ error: 'CONTACT_INVALID' });
      }
      const result = await mutate(
        access.database,
        access.session,
        payload.operation,
        payload.args,
        currentTime,
      );
      return response.status(200).json({ result });
    } catch (error) {
      const failure = contactErrorResponse(error);
      return response.status(failure.status).json({ error: failure.error });
    }
  };
}

export function createTursoContactUnsubscribeHandler({
  connect = createTursoConnection,
  enabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  unsubscribe = unsubscribeTursoContact,
  now = () => new Date(),
} = {}) {
  return async function tursoContactUnsubscribeHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return response.status(403).json({ error: 'origin_not_allowed' });
    if (!(typeof enabled === 'function' ? enabled() : enabled)) {
      return response.status(503).json({ error: 'CONTACT_UNAVAILABLE' });
    }
    if (requestBodyTooLarge(request)) {
      return response.status(413).json({ error: 'CONTACT_INVALID_UNSUBSCRIBE' });
    }
    try {
      const payload = parseJsonBody(request);
      const token = payload?.token;
      if (typeof token !== 'string') {
        return response.status(400).json({ error: 'CONTACT_INVALID_UNSUBSCRIBE' });
      }
      const database = connect();
      const result = await unsubscribe(database, token, now());
      return response.status(200).json({ result });
    } catch (error) {
      const failure = contactErrorResponse(error);
      return response.status(failure.status).json({ error: failure.error });
    }
  };
}
