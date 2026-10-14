import { createTursoConnection } from '../server/turso.js';

const CACHE = 'public, max-age=20, s-maxage=60, stale-while-revalidate=300';
const MAX_PUBLIC_SEO_TAGS = 4096;

function safeSeoTags(value) {
  if (typeof value !== 'string' || value.length > MAX_PUBLIC_SEO_TAGS ||
      /data:image\/[^;,]+;base64,/i.test(value)) return null;
  return value;
}

export function createListingMetadataHandler({ connect = createTursoConnection } = {}) {
  return async function listingMetadataHandler(request, response) {
    response.setHeader('Cache-Control', CACHE);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'method_not_allowed' });
    }

    const rawId = request.query?.id;
    const id = typeof rawId === 'string' && /^\d{1,12}$/.test(rawId)
      ? Number(rawId)
      : NaN;
    if (!Number.isSafeInteger(id) || id < 1) {
      return response.status(400).json({ error: 'invalid_listing_id' });
    }

    try {
      const database = connect();
      const row = await database.get(
        'SELECT seotags FROM listings WHERE id = ? AND status = ? LIMIT 1',
        id,
        'approved',
      );
      if (!row) return response.status(404).json({ error: 'listing_not_found' });
      return response.status(200).json({ seotags: safeSeoTags(row.seotags) });
    } catch {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(502).json({ error: 'database_unavailable' });
    }
  };
}

export default createListingMetadataHandler();
