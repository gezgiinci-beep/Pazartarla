export const AD_BUCKET = 'site-advertisements';
export const AD_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
export const AD_IMAGE_LIMIT = 10 * 1024 * 1024;
export const AD_VIDEO_LIMIT = 50 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm'
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const apiBase = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

export interface Advertisement {
  id: string; title: string; target_url: string | null;
  media_path: string; media_type: 'image' | 'video';
  is_active: boolean; revision: number; created_at: string;
}
export interface AdvertisementDraft {
  id: string; title: string; target_url: string; is_active: boolean;
  file: File | null; existing: Advertisement | null;
}
export class AdConflictError extends Error {
  constructor() { super('Bu reklam başka bir oturumda değişti veya silindi. Güncel listeyi kontrol edip düzenlemeyi yeniden açın. Taslağınız korunuyor.'); }
}

export function adPublicationConfirmation(title: string, publish: boolean) {
  return publish
    ? `“${title}” reklamı onaylanıp yayına alınsın mı? Onaydan sonra tüm ziyaretçilere görünür.`
    : `“${title}” reklamı duraklatılsın mı? Ziyaretçilere gösterimi hemen durur.`;
}

export function adFields(title: string, target: string, isActive: boolean) {
  title = title.trim();
  target = target.trim();
  if (!title || title.length > 120) throw new Error('Reklam başlığı 1–120 karakter olmalı.');
  if (typeof isActive !== 'boolean') throw new Error('Yayın durumu geçersiz.');
  if (target) {
    let url: URL;
    try { url = new URL(target); } catch { throw new Error('Bağlantıyı https:// ile başlayan tam adres olarak yazın.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || target.length > 2048) {
      throw new Error('Yalnızca geçerli http/https bağlantıları kullanılabilir.');
    }
    target = url.href;
    if (target.length > 2048) throw new Error('Bağlantı en fazla 2048 karakter olabilir.');
  }
  return { title, target_url: target || null, is_active: isActive };
}

export function adSaveFields(draft: Pick<AdvertisementDraft, 'title' | 'target_url' | 'is_active' | 'existing'>) {
  return adFields(draft.title, draft.target_url, draft.existing ? draft.is_active : false);
}

export function adFile(file: Pick<File, 'type' | 'size'>) {
  const extension = extensions[file.type];
  if (!extension) throw new Error('JPG, PNG, WEBP görseli veya MP4, WEBM videosu seçin.');
  const media_type = file.type.startsWith('video/') ? 'video' : 'image';
  if (file.size < 1 || file.size > (media_type === 'video' ? AD_VIDEO_LIMIT : AD_IMAGE_LIMIT)) {
    throw new Error(media_type === 'video' ? 'Video boş olmamalı ve en fazla 50 MB olabilir.' : 'Görsel boş olmamalı ve en fazla 10 MB olabilir.');
  }
  return { extension, media_type } as const;
}
export function parseAd(value: unknown): Advertisement {
  const row = value as Advertisement;
  let mediaPath = row?.media_path;
  if (typeof mediaPath === 'string' && mediaPath.startsWith('https://')) {
    try {
      const blob = new URL(mediaPath);
      if (blob.protocol !== 'https:' || blob.username || blob.password ||
          !blob.hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error();
      mediaPath = decodeURIComponent(blob.pathname.replace(/^\/+/, ''));
    } catch {
      throw new Error('Sunucudaki reklam kaydı geçersiz. Listeyi yeniden yükleyin.');
    }
  }
  if (!row || !uuid.test(row.id) || typeof row.title !== 'string' || typeof row.is_active !== 'boolean' ||
      (row.target_url !== null && typeof row.target_url !== 'string') ||
      !['image', 'video'].includes(row.media_type) || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      typeof row.created_at !== 'string' || typeof mediaPath !== 'string' ||
      !new RegExp('^' + row.id + '/[0-9a-f-]{36}\\.(jpg|png|webp|mp4|webm)$', 'i').test(mediaPath)) {
    throw new Error('Sunucudaki reklam kaydı geçersiz. Listeyi yeniden yükleyin.');
  }
  adFields(row.title, row.target_url ?? '', row.is_active);
  return row;
}
export function adMediaUrl(url: string, ad: Advertisement) {
  if (ad.media_path.startsWith('https://')) return ad.media_path;
  return baseUrl(url) + '/storage/v1/object/public/' + AD_BUCKET + '/' +
    ad.media_path.split('/').map(encodeURIComponent).join('/');
}
export async function readTursoAds(request=fetch):Promise<Advertisement[]> {
  const response=await request(apiBase+'/api/advertisements',{
    credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',
    signal:AbortSignal.timeout(15_000)
  });
  await checked(response);
  const payload=await response.json();
  if(!Array.isArray(payload?.advertisements))throw new Error('Reklam listesi yüklenemedi.');
  return payload.advertisements.map(parseAd);
}
export async function readTursoAd(id:string,request=fetch):Promise<Advertisement|null> {
  if(!uuid.test(id))throw new Error('Geçersiz reklam kimliği.');
  const response=await request(apiBase+'/api/advertisements?id='+encodeURIComponent(id),{
    credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',
    signal:AbortSignal.timeout(15_000)
  });
  if(response.status===404)return null;
  await checked(response);
  const payload=await response.json();
  return payload?.advertisement?parseAd(payload.advertisement):null;
}
export async function mutateTursoAd(
  method:'POST'|'PATCH',id:string,revision:number|undefined,fields:Record<string,unknown>,request=fetch
):Promise<Advertisement> {
  if(!uuid.test(id)||(method==='PATCH'&&(!Number.isSafeInteger(revision)||!revision)))throw new Error('Geçersiz reklam sürümü.');
  const response=await request(apiBase+'/api/advertisements',{
    method,credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({...fields,id,...(method==='PATCH'?{revision}:{})}),
    signal:AbortSignal.timeout(15_000)
  });
  await checked(response);
  const payload=await response.json();
  if(!payload?.advertisement)throw new Error('Sunucu reklam değişikliğini doğrulamadı.');
  const row=parseAd(payload.advertisement);
  if(row.id!==id||(method==='PATCH'&&row.revision<=revision!))throw new Error('Sunucu reklam değişikliğini doğrulamadı.');
  return row;
}
export async function deleteTursoAd(id:string,revision:number,request=fetch):Promise<void> {
  if(!uuid.test(id)||!Number.isSafeInteger(revision)||revision<1)throw new Error('Geçersiz reklam sürümü.');
  const response=await request(apiBase+'/api/advertisements',{
    method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({id,revision}),signal:AbortSignal.timeout(15_000)
  });
  await checked(response);
  const payload=await response.json();
  if(payload?.advertisement?.id!==id||payload.advertisement.deleted!==true)throw new Error('Sunucu reklamı silmedi.');
}
export async function uploadTursoAdMedia(id:string,file:File,request=fetch):Promise<{media_path:string;media_type:'image'|'video'}> {
  if(!uuid.test(id))throw new Error('Geçersiz reklam kimliği.');
  const response=await request(apiBase+'/api/advertisement-media?id='+encodeURIComponent(id),{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},
    body:file,signal:AbortSignal.timeout(120_000)
  });
  await checked(response);
  const payload=await response.json();
  if(typeof payload?.media_path!=='string'||!['image','video'].includes(payload.media_type))
    throw new Error('Reklam dosyası sunucudan doğrulanamadı.');
  return {media_path:payload.media_path,media_type:payload.media_type};
}
export async function deleteTursoAdMedia(mediaUrl:string,request=fetch):Promise<void> {
  const response=await request(apiBase+'/api/advertisement-media-delete',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({url:mediaUrl}),signal:AbortSignal.timeout(15_000)
  });
  await checked(response);
}
async function checked(response: Response) {
  if (response.ok) return;
  if ([401, 403].includes(response.status)) throw new Error('Reklam yönetimi için yetkili hesabınızla tekrar giriş yapın.');
  if (response.status === 404) throw new Error('Reklam veritabanı kurulmamış. Reklam geçişini uygulayın.');
  if (response.status === 409) throw new AdConflictError();
  const error = new Error('Reklam sunucusu işlemi tamamlayamadı (HTTP ' + response.status + '). Lütfen tekrar deneyin.') as Error & {
    status?: number;
    retryAfterMs?: number;
  };
  error.status = response.status;
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) error.retryAfterMs = seconds * 1000;
    else if (Number.isFinite(retryAt)) error.retryAfterMs = Math.max(0, retryAt - Date.now());
  }
  throw error;
}
function baseUrl(url: string) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Sunucu bağlantı ayarları eksik: VITE_SUPABASE_URL tanımlanmalı. Ayarlar düzeltildikten sonra site yeniden derlenip yayımlanmalı.');
  }
  let address: URL;
  try { address = new URL(url.trim()); }
  catch { throw new Error('Sunucu bağlantı adresi geçersiz: VITE_SUPABASE_URL ayarını kontrol edin.'); }
  if (!['https:', 'http:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error('Sunucu bağlantı adresi geçersiz: VITE_SUPABASE_URL ayarını kontrol edin.');
  }
  return url.trim().replace(/\/+$/, '');
}
function endpoint(url: string) { return baseUrl(url) + '/rest/v1/advertisements'; }
const select = 'id,title,target_url,media_path,media_type,is_active,revision,created_at';
export async function readAds(url: string, headers: Record<string, string>, request = fetch): Promise<Advertisement[]> {
  const response = await request(endpoint(url) + '?select=' + select + '&order=created_at.desc', {
    headers, cache: 'no-store', signal: AbortSignal.timeout(15_000)
  });
  await checked(response);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Reklam listesi yüklenemedi.');
  return rows.map(parseAd);
}
export async function readPublicAdvertisementsFromApi(apiUrl: string, request = fetch): Promise<Advertisement[]> {
  if (typeof apiUrl !== 'string' || !apiUrl.startsWith('/') || apiUrl.startsWith('//')) {
    throw new Error('Reklam sunucusu adresi geçersiz.');
  }
  const separator = apiUrl.includes('?') ? '&' : '?';
  const response = await request(apiUrl + separator + 'resource=advertisements', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'default',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const error = new Error(`Reklam sunucusu isteği tamamlanamadı (HTTP ${response.status}).`) as Error & {
      status?: number;
      retryAfterMs?: number;
    };
    error.status = response.status;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) error.retryAfterMs = seconds * 1000;
      else if (Number.isFinite(retryAt)) error.retryAfterMs = Math.max(0, retryAt - Date.now());
    }
    throw error;
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.advertisements)) throw new Error('Reklam listesi sunucudan alınamadı.');
  return payload.advertisements.map(parseAd);
}
export async function readAd(url: string, headers: Record<string, string>, id: string, request = fetch) {
  if (!uuid.test(id)) throw new Error('Geçersiz reklam kimliği.');
  const response = await request(endpoint(url) + '?id=eq.' + id + '&select=' + select, {
    headers, cache: 'no-store', signal: AbortSignal.timeout(15_000)
  });
  await checked(response);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('Reklam kaydı doğrulanamadı.');
  return rows.length ? parseAd(rows[0]) : null;
}
export async function mutateAd(
  url: string, headers: Record<string, string>, method: 'POST' | 'PATCH' | 'DELETE',
  id: string, revision: number | undefined, fields: Record<string, unknown> | null, request = fetch
): Promise<Advertisement> {
  if (!uuid.test(id) || (method !== 'POST' && (!Number.isSafeInteger(revision) || revision! < 1))) {
    throw new Error('Geçersiz reklam sürümü.');
  }
  const filter = method === 'POST' ? '' : '&id=eq.' + id + '&revision=eq.' + revision;
  const response = await request(endpoint(url) + '?select=' + select + filter, {
    method, headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: fields ? JSON.stringify(fields) : undefined, signal: AbortSignal.timeout(15_000)
  });
  await checked(response);
  const rows = await response.json();
  if (Array.isArray(rows) && !rows.length) throw new AdConflictError();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Sunucu reklam işlemini doğrulamadı. Listeyi yeniden yükleyin.');
  const row = parseAd(rows[0]);
  if (row.id !== id || (method === 'PATCH' && row.revision <= revision!)) throw new Error('Sunucu reklam değişikliğini doğrulamadı.');
  return row;
}