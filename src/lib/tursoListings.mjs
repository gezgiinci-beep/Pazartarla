import { retryAfterDelayMs } from './publicReadResilience.mjs';

function requireSuccessfulResponse(response, label) {
  if (!response?.ok) {
    const error = new Error(`${label} HTTP ${response?.status ?? 'error'}`);
    error.status = response?.status;
    error.retryAfterMs = retryAfterDelayMs(response?.headers);
    throw error;
  }
}

export async function readPublicListingsFromApi(request = fetch) {
  const response = await request('/api/public-listings', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  requireSuccessfulResponse(response, 'Turso listings');
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.listings)) {
    throw new Error('Invalid Turso listings response');
  }
  return payload.listings;
}

export async function readListingSeoFromApi(id, request = fetch) {
  const listingId = Number(id);
  if (!Number.isSafeInteger(listingId) || listingId < 1) {
    throw new Error('İlan kimliği geçersiz.');
  }
  const query = new URLSearchParams({ id: String(listingId) });
  const response = await request(`/api/listing-metadata?${query}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  requireSuccessfulResponse(response, 'Turso listing metadata');
  const payload = await response.json();
  if (!payload || !(payload.seotags === null || typeof payload.seotags === 'string')) {
    throw new Error('Invalid Turso listing metadata response');
  }
  return payload.seotags;
}
