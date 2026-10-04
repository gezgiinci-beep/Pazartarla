export type Categories = Record<string, string[]>;

export interface SiteSettings {
  id: 'public';
  announcement: string;
  categories: Categories;
  revision: number;
}

export type SettingsPatch = Partial<Pick<SiteSettings, 'announcement' | 'categories'>>;

export class SettingsConflictError extends Error {
  constructor() {
    super('Ayarlar başka bir oturumda değiştirildi. Güncel ayarları kontrol edip tekrar deneyin. Duyuru taslağını yenilemek için “Sunucudaki duyuruyu al” düğmesini kullanın.');
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
      row.announcement.length > 1000 || !validCategories(row.categories) ||
      !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error('Sunucudaki site ayarları geçersiz veya eksik. Yöneticiyle iletişime geçin.');
  }
  return row;
}

function endpoint(url: string) {
  return url.replace(/\/$/, '') + '/rest/v1/site_settings?id=eq.public&select=id,announcement,categories,revision';
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
  const response = await request(endpoint(url), {
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
      !['announcement', 'categories'].includes(keys[0])) {
    throw new Error('Geçersiz ayar değişikliği.');
  }
  if ('announcement' in patch && (typeof patch.announcement !== 'string' || patch.announcement.length > 1000)) {
    throw new Error('Duyuru en fazla 1000 karakter olabilir.');
  }
  if ('categories' in patch && !validCategories(patch.categories)) {
    throw new Error('En az bir ana kategori ve her kategoride en az bir alt seçenek olmalı. İsimler 1–100 karakter olmalı ve tekrarlanmamalı.');
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
  return saved;
}