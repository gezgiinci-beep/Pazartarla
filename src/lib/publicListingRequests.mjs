import { retryAfterDelayMs } from './publicReadResilience.mjs';

const publicListingColumns = [
  'id', 'title', 'price', 'category', 'subCategory', 'mode', 'location',
  'description', 'seller', 'phone', 'image', 'gallery_paths', 'is_featured',
  'status', 'created_at', 'expires_at', 'submitted_by',
];

function listingsEndpoint(baseUrl) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error('Supabase adresi geçersiz.');
  }
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password ||
      base.search || base.hash) {
    throw new Error('Supabase adresi geçersiz.');
  }
  base.pathname = base.pathname.replace(/\/+$/, '') + '/rest/v1/listings';
  return base;
}

export function publicListingsUrl(baseUrl) {
  const url = listingsEndpoint(baseUrl);
  url.searchParams.set('select', publicListingColumns.join(','));
  url.searchParams.set('status', 'eq.approved');
  url.searchParams.set('order', 'created_at.desc');
  return url.toString();
}

export function legacyListingMetadataUrl(baseUrl, ids) {
  if (!Array.isArray(ids) || ids.length === 0 ||
      ids.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) {
    throw new Error('Eski ilan verisi için kimlik listesi geçersiz.');
  }
  const uniqueIds = [...new Set(ids.map(Number))];
  const url = listingsEndpoint(baseUrl);
  url.searchParams.set('select', 'id,seotags');
  url.searchParams.set('id', `in.(${uniqueIds.join(',')})`);
  url.searchParams.set('status', 'eq.approved');
  return url.toString();
}

export function listingSeoMetadataUrl(baseUrl, id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    throw new Error('İlan kimliği geçersiz.');
  }
  const url = listingsEndpoint(baseUrl);
  url.searchParams.set('select', 'id,seotags');
  url.searchParams.set('id', `eq.${Number(id)}`);
  url.searchParams.set('limit', '1');
  return url.toString();
}

async function readRows(request, url, headers) {
  const response = await request(url, { headers, cache: 'no-store' });
  if (!response.ok) {
    const error = new Error('HTTP ' + response.status);
    error.status = response.status;
    error.retryAfterMs = retryAfterDelayMs(response.headers);
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid listings response');
  return rows;
}

export async function readPublicListings(baseUrl, headers, request = fetch) {
  const rows = await readRows(request, publicListingsUrl(baseUrl), headers);
  const legacyRows = rows.filter(row => row && (row.gallery_paths == null || typeof row.is_featured !== 'boolean'));
  if (legacyRows.length === 0) return rows;

  const metadataRows = await readRows(
    request,
    legacyListingMetadataUrl(baseUrl, legacyRows.map(row => row.id)),
    headers,
  );
  const metadataById = new Map(metadataRows.map(row => [String(row.id), row.seotags ?? null]));
  return rows.map(row => legacyRows.includes(row)
    ? { ...row, seotags: metadataById.get(String(row.id)) ?? null }
    : row);
}
