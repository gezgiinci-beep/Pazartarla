export type Categories = Record<string, string[]>;
export type FeaturedOffer = { monthly_price_try: number; description: string };

export function validFeaturedOffer(value: unknown): value is FeaturedOffer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const offer = value as FeaturedOffer;
  const keys = Object.keys(value);
  const price = offer.monthly_price_try;
  return keys.length === 2 && keys.includes('monthly_price_try') && keys.includes('description') &&
    typeof price === 'number' && Number.isFinite(price) && price > 0 && price <= 1_000_000 &&
    Number(price.toFixed(2)) === price &&
    typeof offer.description === 'string' && offer.description.length <= 400;
}

export interface SiteSettings {
  id: 'public';
  announcement: string;
  categories: Categories;
  featured_offer: FeaturedOffer;
  revision: number;
}

export type SettingsPatch = Partial<Pick<SiteSettings, 'announcement' | 'categories' | 'featured_offer'>>;

export class SettingsConflictError extends Error {
  constructor() {
    super('Ayarlar başka bir oturumda değiştirildi. Güncel ayarları kontrol edip tekrar deneyin. Taslağı yenilemek için ilgili ayar bölümündeki sunucudan güncel değerleri alma düğmesini kullanın.');
  }
}

export function validCategories(value: unknown): value is Categories {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.length <= 100 && entries.every(([name, subs]) =>
    name.trim() === name && name.length > 0 && name.length <= 100 &&
    !['__proto__', 'constructor', 'prototype'].includes(name) &&
    Array.isArray(subs) && subs.length > 0 && subs.length <= 200 &&
    subs.every(sub => typeof sub === 'string' && sub.trim() === sub && sub.length > 0 && sub.length <= 100) &&
    new Set(subs).size === subs.length
  );
}

export function parseSiteSettings(value: unknown): SiteSettings {
  const row = value as SiteSettings | null;
  if (!row || row.id !== 'public' || typeof row.announcement !== 'string' ||
      row.announcement.length > 1000 || !validCategories(row.categories) || !validFeaturedOffer(row.featured_offer) ||
      !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error('Sunucudaki site ayarları geçersiz veya eksik. Yöneticiyle iletişime geçin.');
  }
  return row;
}

function endpoint(url: string) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Sunucu bağlantı ayarları eksik: VITE_SUPABASE_URL tanımlanmalı. Ayarlar düzeltildikten sonra site yeniden derlenip yayımlanmalı.');
  }
  let address: URL;
  try { address = new URL(url.trim()); }
  catch { throw new Error('Sunucu bağlantı adresi geçersiz: VITE_SUPABASE_URL ayarını kontrol edin.'); }
  if (!['https:', 'http:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error('Sunucu bağlantı adresi geçersiz: VITE_SUPABASE_URL ayarını kontrol edin.');
  }
  return url.trim().replace(/\/$/, '') + '/rest/v1/site_settings?id=eq.public&select=id,announcement,categories,featured_offer,revision';
}

async function requireOk(response: Response) {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new Error('Site ayarlarına erişim reddedildi. Kaydetmek için yetkili yönetici hesabıyla tekrar giriş yapın.');
  }
  if (response.status === 404) {
    throw new Error('Ortak site ayarları kurulmamış. Site ayarları veritabanı geçişini uygulayın.');
  }
  throw new Error('Site ayarları sunucusuna ulaşılamadı (HTTP ' + response.status + '). Lütfen yeniden deneyin.');
}

export async function readSiteSettings(url: string, key: string, request = fetch): Promise<SiteSettings> {
  const target = endpoint(url);
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('Sunucu bağlantı ayarları eksik: tarayıcı için VITE_SUPABASE_ANON_KEY tanımlanmalı. Gizli servis anahtarı kullanılmamalı.');
  }
  const response = await request(target, {
    headers: { apikey: key },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000)
  });
  await requireOk(response);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Ortak site ayarları kaydı bulunamadı. Site ayarları veritabanı geçişini uygulayın.');
  }
  return parseSiteSettings(rows[0]);
}

export async function writeSiteSettings(
  url: string,
  headers: Record<string, string>,
  revision: number,
  patch: SettingsPatch,
  request = fetch
): Promise<SiteSettings> {
  const keys = Object.keys(patch);
  if (!Number.isSafeInteger(revision) || revision < 1 || keys.length !== 1 ||
       !['announcement', 'categories', 'featured_offer'].includes(keys[0])) {
    throw new Error('Geçersiz ayar değişikliği.');
  }
  if ('announcement' in patch && (typeof patch.announcement !== 'string' || patch.announcement.length > 1000)) {
    throw new Error('Duyuru en fazla 1000 karakter olabilir.');
  }
  if ('categories' in patch && !validCategories(patch.categories)) {
    throw new Error('En az bir ana kategori ve her kategoride en az bir alt seçenek olmalı. İsimler 1–100 karakter olmalı ve tekrarlanmamalı.');
  }
  if ('featured_offer' in patch && !validFeaturedOffer(patch.featured_offer)) {
    throw new Error('Vitrin fiyatı 0’dan büyük, en fazla 1.000.000 TL ve en fazla iki ondalık basamaklı olmalı. Açıklama en fazla 400 karakter olabilir.');
  }
  const response = await request(endpoint(url) + '&revision=eq.' + revision, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(15_000)
  });
  await requireOk(response);
  const rows = await response.json();
  if (Array.isArray(rows) && rows.length === 0) throw new SettingsConflictError();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Sunucu ayar değişikliğini doğrulamadı. Yenileyip kontrol edin.');
  const saved = parseSiteSettings(rows[0]);
  if (saved.revision <= revision) throw new Error('Sunucu ayar değişikliğini doğrulamadı. Yenileyip kontrol edin.');
  if (patch.featured_offer && (saved.featured_offer.monthly_price_try !== patch.featured_offer.monthly_price_try ||
      saved.featured_offer.description !== patch.featured_offer.description)) {
    throw new Error('Sunucu vitrin ücreti değişikliğini doğrulamadı. Yenileyip kontrol edin.');
  }
  return saved;
}