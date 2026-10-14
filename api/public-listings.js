import { createTursoConnection } from '../server/turso.js';
import { readPublicListingsFromTurso } from '../server/publicListings.js';
import { readPublicAdvertisementsFromTurso } from '../server/publicAdvertisements.js';
import { retryAfterDelayMs } from '../src/lib/publicReadResilience.mjs';

const SUCCESS_CACHE = 'public, max-age=20, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600';

export function createPublicListingsHandler({
  connect = createTursoConnection,
  readListings = readPublicListingsFromTurso,
  readAdvertisements = readPublicAdvertisementsFromTurso,
} = {}) {
  return async function publicListingsHandler(request, response) {
    response.setHeader('Cache-Control', SUCCESS_CACHE);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'method_not_allowed' });
    }

    try {
      const database = connect();
      const requestedResource = request.query?.resource ??
        new URL(request.url || '/', 'http://localhost').searchParams.get('resource');
      const resource = Array.isArray(requestedResource) ? requestedResource[0] : requestedResource;
      if (resource === 'advertisements') {
        const advertisements = await readAdvertisements(database);
        return response.status(200).json({ advertisements });
      }
      if (resource && resource !== 'listings') {
        response.setHeader('Cache-Control', 'no-store');
        return response.status(404).json({ error: 'resource_not_found' });
      }
      const listings = await readListings(database);
      return response.status(200).json({ listings });
    } catch (error) {
      response.setHeader('Cache-Control', 'no-store');
      const code = error?.code === 'TURSO_NOT_CONFIGURED'
        ? 'database_not_configured'
        : 'database_unavailable';
      const upstreamStatus = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
      if (upstreamStatus === 402 || upstreamStatus === 429) {
        const retryAfterMs = Number(error?.retryAfterMs) ||
          retryAfterDelayMs(error?.headers ?? error?.response?.headers) || 300_000;
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil(Math.min(60 * 60_000, retryAfterMs) / 1000))));
        return response.status(upstreamStatus).json({ error: 'database_unavailable' });
      }
      const status = code === 'database_not_configured' ? 503 : 502;
      return response.status(status).json({ error: code });
    }
  };
}

export default createPublicListingsHandler();
