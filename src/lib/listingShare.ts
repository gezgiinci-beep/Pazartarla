export const PUBLIC_LISTING_SITE = 'https://www.pazartarla.com.tr/';

function validId(value: unknown): string | null {
  const id = String(value ?? '');
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : null;
}

export function listingIdFromUrl(value: string): string | null {
  try {
    return validId(new URL(value).searchParams.get('ilan'));
  } catch {
    return null;
  }
}

export function listingShareUrl(id: unknown): string {
  const safeId = validId(id);
  if (!safeId) throw new Error('İlan bağlantısı için geçerli bir ilan numarası gerekli.');
  const url = new URL(PUBLIC_LISTING_SITE);
  url.searchParams.set('ilan', safeId);
  return url.toString();
}

export function listingShareText(listing: {
  id: unknown;
  title: string;
  price: number | string;
  location: string;
}): string {
  return `PazarTarla İlanı\n${listing.title}\nFiyat: ${Number(listing.price).toLocaleString('tr-TR')} TL\nKonum: ${listing.location}\nİlanı incelemek için bağlantıya tıklayın:\n${listingShareUrl(listing.id)}`;
}

export function listingPhotoAddress(
  listing: { images?: unknown; image?: unknown } | null | undefined,
  currentPage = PUBLIC_LISTING_SITE,
): string | null {
  const galleryImage = Array.isArray(listing?.images)
    ? listing.images.find((image): image is string => typeof image === 'string' && image.trim())
    : null;
  const image = galleryImage || listing?.image;
  if (typeof image !== 'string' || !image.trim()) return null;

  try {
    const url = new URL(image.trim(), currentPage);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function findSharedListing<T extends { id: unknown; status?: string }>(
  rows: T[],
  id: string,
): T | null {
  return rows.find((row) => String(row.id) === id && row.status === 'approved') ?? null;
}
