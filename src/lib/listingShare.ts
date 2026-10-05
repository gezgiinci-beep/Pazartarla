// The verified public www site, never the editor/preview address.
export const PUBLIC_LISTING_SITE = 'https://www.pazartarla.com.tr/';

function validId(value: unknown): string | null {
  const id = String(value ?? '');
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : null;
}

export function listingIdFromUrl(value: string): string | null {
  try { return validId(new URL(value).searchParams.get('ilan')); }
  catch { return null; }
}

export function listingShareUrl(id: unknown): string {
  const safeId = validId(id);
  if (!safeId) throw new Error('İlan bağlantısı için geçerli bir ilan numarası gerekiyor.');
  const url = new URL(PUBLIC_LISTING_SITE);
  url.searchParams.set('ilan', safeId);
  return url.toString();
}

export function listingShareText(listing: { id: unknown; title: string; price: number | string; location: string }): string {
  return `PazarTarla İlanı\n${listing.title}\nFiyat: ${Number(listing.price).toLocaleString('tr-TR')} TL\nKonum: ${listing.location}\nİlanı incelemek için bağlantıya tıklayın:\n${listingShareUrl(listing.id)}`;
}

export function findSharedListing<T extends { id: unknown; status?: string }>(rows: T[], id: string): T | null {
  return rows.find(row => String(row.id) === id && row.status === 'approved') ?? null;
}
