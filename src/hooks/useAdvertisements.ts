import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AD_BUCKET, AdConflictError, adFile, adMediaUrl, adSaveFields, deleteTursoAd, deleteTursoAdMedia, mutateAd, mutateTursoAd, parseAd, readAd, readAds, readTursoAd, readTursoAds, readPublicAdvertisementsFromApi, uploadTursoAdMedia } from '../lib/advertisements';
import type { Advertisement, AdvertisementDraft } from '../lib/advertisements';
import {replaceAdAsset} from '../lib/adReplacement';
import {optimizeAdImage} from '../lib/adImage';
import {AUTOMATIC_REFRESH_INTERVAL_MS, automaticRefreshDue} from '../lib/refreshPolicy.mjs';

const explain = (e: unknown) => e instanceof Error ? e.message : 'Bağlantı kesildi. Lütfen yeniden deneyin.';
const PUBLIC_AD_CACHE_KEY = 'pazartarla-public-advertisements-v1';
const PUBLIC_AD_RETRY_KEY = 'pazartarla-public-advertisements-retry-at-v1';
const PUBLIC_AD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TURSO_AUTH_ENABLED = import.meta.env.VITE_AUTH_BACKEND === 'turso';

function readPublicAdRetryAt() {
  try {
    const retryAt = Number(localStorage.getItem(PUBLIC_AD_RETRY_KEY));
    return Number.isSafeInteger(retryAt) && retryAt > Date.now() ? retryAt : 0;
  } catch {
    return 0;
  }
}

function readPublicAdCache(): Advertisement[] | null {
  try {
    const saved = localStorage.getItem(PUBLIC_AD_CACHE_KEY);
    if (!saved) return null;
    const entry = JSON.parse(saved);
    if (!Number.isFinite(entry?.savedAt) || Date.now() - entry.savedAt > PUBLIC_AD_CACHE_TTL_MS ||
        !Array.isArray(entry?.items) || entry.items.length > 100) return null;
    return entry.items.map(parseAd).filter((ad: Advertisement) => ad.is_active);
  } catch {
    return null;
  }
}

function savePublicAdCache(items: Advertisement[]) {
  try {
    localStorage.setItem(PUBLIC_AD_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items: items.filter(ad => ad.is_active),
    }));
  } catch {
    // Private browsing or storage limits must not interrupt public rendering.
  }
}

export function useAdvertisements(
  client: SupabaseClient | null, url: string, key: string, admin: boolean,
  getAdminHeaders: () => Promise<Record<string, string>>,
  publicApiUrl = '/api/public-listings',
  useTursoPublicRead = false,
) {
  const [items, setItems] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const mounted = useRef(false);
  const sequence = useRef(0);
  const locked = useRef(false);
  const lastRefreshAt = useRef(0);
  const failureCount = useRef(0);
  const retryAt = useRef(0);
  const cleanup = useRef<string[]>([]);
  const pending = useRef<{ id: string; path: string; file: File } | null>(null);
  const replacement = useRef<Parameters<typeof replaceAdAsset>[1]['current']>(null);
  const headers = useCallback(async () => admin ? getAdminHeaders() : { apikey: key }, [admin, key, getAdminHeaders]);
  const refresh = useCallback(async () => {
    if (locked.current) return;
    if (Date.now() < retryAt.current) return;
    lastRefreshAt.current = Date.now();
    const n = ++sequence.current;
    try {
      const rows = !admin && useTursoPublicRead
        ? await readPublicAdvertisementsFromApi(publicApiUrl)
        : admin && TURSO_AUTH_ENABLED
          ? await readTursoAds()
          : await readAds(url, await headers());
      if (mounted.current && sequence.current === n) {
        setItems(rows);
        if (!admin) savePublicAdCache(rows);
        failureCount.current = 0;
        retryAt.current = 0;
        if (!admin) {
          try { localStorage.removeItem(PUBLIC_AD_RETRY_KEY); } catch { /* Storage is optional. */ }
        }
        setError('');
      }
    } catch (e) {
      const retry = ++failureCount.current;
      const fallbackDelay = Math.min(30 * 60_000, 15_000 * 2 ** Math.min(retry - 1, 7));
      const serverDelay = Number((e as Error & { retryAfterMs?: number })?.retryAfterMs) || 0;
      retryAt.current = Date.now() + Math.min(60 * 60_000, Math.max(fallbackDelay, serverDelay));
      if (!admin) {
        try { localStorage.setItem(PUBLIC_AD_RETRY_KEY, String(retryAt.current)); } catch { /* Storage is optional. */ }
      }
      if (mounted.current && sequence.current === n) {
        // Public visitors keep the last successful/cache copy and never see quota error banners.
        setError(admin ? 'Reklamlar yüklenemedi. ' + explain(e) : '');
      }
    } finally {
      if (mounted.current && sequence.current === n) setLoading(false);
    }
  }, [url, headers, publicApiUrl, useTursoPublicRead, admin]);
  useEffect(() => {
    mounted.current = true;
    ++sequence.current;
    const cached = admin ? null : readPublicAdCache();
    retryAt.current = admin ? 0 : readPublicAdRetryAt();
    if (cached) { setItems(cached); setLoading(false); }
    else setItems([]);
    setLoading(!cached && !(retryAt.current > Date.now())); setSaveError(''); setSuccess(''); setWarning('');
    if (!admin) { pending.current = null; cleanup.current = []; }
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible' && automaticRefreshDue(lastRefreshAt.current)) void refresh();
    };
    const timer = window.setInterval(visible, AUTOMATIC_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false; ++sequence.current;
      window.clearInterval(timer); window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, admin]);
  const mediaUrl = (ad: Advertisement) => adMediaUrl(url, ad);
  const removeFile = async (path: string) => {
    if (TURSO_AUTH_ENABLED) {
      // Preserve legacy Supabase objects; only newly migrated Blob URLs can be removed here.
      if (!path.startsWith('https://')) return true;
      try {
        await deleteTursoAdMedia(path);
        cleanup.current = cleanup.current.filter(item => item !== path);
        if (mounted.current && !cleanup.current.length) setWarning('');
        return true;
      } catch {
        cleanup.current = Array.from(new Set([...cleanup.current, path]));
        if (mounted.current) setWarning('Reklam kaydı işlendi fakat kullanılmayan dosya silinemedi. Dosya temizliğini yeniden deneyin.');
        return false;
      }
    }
    if (!client) throw new Error('Dosya depolama bağlantısı eksik.');
    let error: unknown;
    try {({error}=await client.storage.from(AD_BUCKET).remove([path]));}
    catch(cause){error=cause;}
    if (error) {
      cleanup.current = Array.from(new Set([...cleanup.current, path]));
      if (mounted.current) setWarning('Reklam kaydı işlendi fakat kullanılmayan dosya silinemedi. Dosya temizliğini yeniden deneyin.');
      return false;
    }
    cleanup.current = cleanup.current.filter(p => p !== path);
    if (mounted.current && !cleanup.current.length) setWarning('');
    return true;
  };
  const saveTurso = async (input: AdvertisementDraft) => {
    if (locked.current || !admin) return null;
    let uploadedPath = '';
    locked.current = true; ++sequence.current;
    setBusy(true); setSaveError(''); setSuccess('');
    try {
      const fields = adSaveFields(input);
      let mediaFields: Record<string, unknown> = {};
      if (input.file) {
        if (pending.current?.id === input.id && pending.current.file === input.file) {
          uploadedPath = pending.current.path;
        } else {
          const prepared = await optimizeAdImage(input.file);
        const uploaded = await uploadTursoAdMedia(input.id, prepared);
          uploadedPath = uploaded.media_path;
          pending.current = { id: input.id, path: uploadedPath, file: input.file };
          mediaFields = { media_path: uploaded.media_path, media_type: uploaded.media_type };
        }
        if (!mediaFields.media_path) {
          const kind = adFile(input.file);
          mediaFields = { media_path: uploadedPath, media_type: kind.media_type };
        }
      }
      const current = input.existing ? await readTursoAd(input.id) : null;
      if (input.existing && (!current || current.revision !== input.existing.revision)) {
        throw new AdConflictError();
      }
      if (!input.existing && !input.file) throw new Error('Bir görsel veya video seçin.');
      const row = input.existing
        ? await mutateTursoAd('PATCH', input.id, input.existing.revision, { ...fields, ...mediaFields })
        : await mutateTursoAd('POST', input.id, undefined, {
          ...fields, ...mediaFields, is_active: false,
        });
      pending.current = null;
      if (mounted.current) {
        setItems(rows => [row, ...rows.filter(item => item.id !== row.id)]);
        const statusChanged = Boolean(input.existing && input.existing.is_active !== row.is_active);
        setSuccess(statusChanged
          ? row.is_active ? 'Yönetici onayı tamamlandı; reklam yayına alındı.' : 'Reklam duraklatıldı.'
          : input.existing ? 'Reklam güncellendi.' : 'Reklam taslağı kaydedildi; ziyaretçilere gösterilmiyor.');
      }
      if (input.existing && input.file && input.existing.media_path !== row.media_path) {
        await removeFile(input.existing.media_path);
      }
      return row;
    } catch (error) {
      if (uploadedPath) {
        try {
          const saved = await readTursoAd(input.id);
          const fields = adSaveFields(input);
          if (saved?.media_path === uploadedPath && saved.title === fields.title &&
              saved.target_url === fields.target_url) {
            pending.current = null;
            if (mounted.current) {
              setItems(rows => [saved, ...rows.filter(item => item.id !== saved.id)]);
              setSuccess('Reklam kaydı sunucudan doğrulandı.');
            }
            return saved;
          }
        } catch { /* Keep the upload available to safely retry an ambiguous commit. */ }
        if (mounted.current) setWarning('Dosya yüklendi fakat reklam kaydı doğrulanamadı. Aynı dosyayla yeniden deneyin; ikinci kez yüklenmeyecek.');
      }
      if (mounted.current) setSaveError('Reklam kaydedilemedi. ' + explain(error));
      if (error instanceof AdConflictError) { locked.current = false; void refresh(); }
      return null;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = async (input: AdvertisementDraft) => {
    if (TURSO_AUTH_ENABLED) return saveTurso(input);
    if (locked.current || !admin) return null;
    let uploaded = '';
    let acknowledged: Advertisement | null = null;
    let authHeaders: Record<string, string> | null = null;
    locked.current = true; ++sequence.current;
    setBusy(true); setSaveError(''); setSuccess('');
    try {
      if (!client) throw new Error('Dosya depolama bağlantısı eksik.');
      // A new record is always stored unpublished; only the separate list action
      // can publish it after the administrator confirms the change.
      const fields = adSaveFields(input);
      authHeaders = await getAdminHeaders();
      if (pending.current) {
        const previous = await readAd(url, authHeaders, pending.current.id);
        if (previous && previous.media_path === pending.current.path) {
          setItems(rows => [previous, ...rows.filter(r => r.id !== previous.id)]);
          pending.current = null;
          if (previous.id === input.id && !input.existing) {
            if (previous.title === fields.title && previous.target_url === fields.target_url && previous.is_active === fields.is_active) {
              setSuccess('Önceki reklam kaydı sunucudan doğrulandı.');
              if (!cleanup.current.length) setWarning('');
              return previous;
            }
            throw new Error('Önceki kayıt sunucuda bulundu. Listedeki reklamı açıp yeni değişikliklerinizi oradan kaydedin.');
          }
        } else if (pending.current.id === input.id && !input.existing) {
          if (pending.current.file !== input.file) throw new Error('Önceki yükleme bekliyor. Aynı dosyayla yeniden deneyin veya yeni reklam formu açın.');
          uploaded = pending.current.path;
        } else {
          cleanup.current.push(pending.current.path);
          setWarning('Önceki yüklemenin kaydı doğrulanamadı. Reklamlar yüklendikten sonra kullanılmayan dosyaları temizleyebilirsiniz.');
          pending.current = null;
        }
      }
      let row: Advertisement;
      let obsoletePath='';
      if (input.existing && input.file) {
        const result=await replaceAdAsset(input,replacement,{
          read:id=>readAd(url,authHeaders!,id),
          prepare:optimizeAdImage,
          upload:async(path,file)=>{
            const result=await client.storage.from(AD_BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
            if(result.error)throw new Error('Yeni görsel yüklenemedi. Mevcut görsel korunuyor.');
          },
          patch:(ad,values)=>mutateAd(url,authHeaders!,'PATCH',ad.id,ad.revision,values),
          orphan:path=>{cleanup.current=Array.from(new Set([...cleanup.current,path]));setWarning('Kullanılmayan yüklemeyi dosya temizliğiyle kaldırabilirsiniz.');},
        });
        row=result.row;obsoletePath=result.obsoletePath;
      } else if (input.existing) {
        row = await mutateAd(url, authHeaders, 'PATCH', input.existing.id, input.existing.revision, fields);
      } else {
        if (!input.file) throw new Error('Bir görsel veya video seçin.');
        if (!uploaded) {
          const prepared=await optimizeAdImage(input.file),kind=adFile(prepared);
          uploaded = input.id + '/' + crypto.randomUUID() + '.' + kind.extension;
          const result = await client.storage.from(AD_BUCKET).upload(uploaded, prepared, {
            contentType: prepared.type, cacheControl: '3600', upsert: false
          });
          if (result.error) { uploaded = ''; throw new Error('Dosya yüklenemedi. Bağlantınızı ve depolama izinlerini kontrol edin.'); }
          pending.current = { id: input.id, path: uploaded, file: input.file };
        }
        row = await mutateAd(url, authHeaders, 'POST', input.id, undefined, {
          ...fields, id: input.id, media_path: uploaded, media_type: /\.(mp4|webm)$/.test(uploaded)?'video':'image'
        });
      }
      acknowledged = row; pending.current = null;
      if (mounted.current) {
        setItems(rows => [row, ...rows.filter(r => r.id !== row.id)]);
        const statusChanged = Boolean(input.existing && input.existing.is_active !== row.is_active);
        setSuccess(statusChanged
          ? row.is_active ? 'Yönetici onayı tamamlandı; reklam yayına alındı.' : 'Reklam duraklatıldı.'
          : input.existing ? 'Reklam güncellendi.' : 'Reklam taslağı kaydedildi; ziyaretçilere gösterilmiyor.');
        if (!cleanup.current.length) setWarning('');
      }
      if(obsoletePath)await removeFile(obsoletePath);
      return row;
    } catch (e) {
      // A lost response may still represent a committed insert. Never delete a referenced upload.
      if (uploaded && authHeaders && !acknowledged) {
        try {
          const saved = await readAd(url, authHeaders, input.id);
          if (saved?.media_path === uploaded) {
            pending.current = null;
            const fields = adSaveFields(input);
            if (saved.title !== fields.title || saved.target_url !== fields.target_url || saved.is_active !== fields.is_active) {
              if (mounted.current) setItems(rows => [saved, ...rows.filter(r => r.id !== saved.id)]);
              throw new Error('Önceki kayıt bulundu; yeni bilgilerinizi listedeki reklamı düzenleyerek kaydedin.');
            }
            if (mounted.current) {
              setItems(rows => [saved, ...rows.filter(r => r.id !== saved.id)]);
              setSuccess('Reklam kaydı sunucudan doğrulandı.');
              if (!cleanup.current.length) setWarning('');
            }
            return saved;
          }
          // Retain and reuse this upload on retry. An aborted insert may still be running.
          if (mounted.current) setWarning('Dosya yüklendi fakat reklam kaydı doğrulanamadı. Taslağınızla yeniden deneyin; aynı dosya tekrar yüklenmeyecek.');
        } catch {
          // Keep the pending identity so retry cannot create a duplicate after an ambiguous response.
        }
      }
      if (mounted.current) setSaveError('Reklam kaydedilemedi. ' + explain(e));
      if (mounted.current && replacement.current) setWarning('Görsel kaydının sonucu belirsiz. Eski dosya silinmedi; aynı taslak ve dosyayla yeniden deneyin.');
      if (e instanceof AdConflictError) { locked.current = false; void refresh(); }
      return null;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async (ad: Advertisement) => {
    if (locked.current || !admin) return false;
    locked.current = true; ++sequence.current; setBusy(true); setSaveError(''); setSuccess('');
    try {
      if (TURSO_AUTH_ENABLED) {
        await deleteTursoAd(ad.id, ad.revision);
        if (mounted.current) {
          setItems(rows => rows.filter(r => r.id !== ad.id));
          setSuccess('Reklam silindi.');
        }
        await removeFile(ad.media_path);
        return true;
      }
      const authHeaders = await getAdminHeaders();
      await mutateAd(url, authHeaders, 'DELETE', ad.id, ad.revision, null);
      if (mounted.current) {
        setItems(rows => rows.filter(r => r.id !== ad.id));
        setSuccess('Reklam silindi.');
      }
      await removeFile(ad.media_path);
      return true;
    } catch (e) {
      if (mounted.current) setSaveError('Reklam silinemedi. ' + explain(e));
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
      void refresh();
    }
  };
  const retryCleanup = async () => {
    if (!admin || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      if (TURSO_AUTH_ENABLED) {
        for (const path of [...cleanup.current]) {
          if (path.startsWith('https://')) await removeFile(path);
          else cleanup.current = cleanup.current.filter(item => item !== path);
        }
        if (!cleanup.current.length) setWarning('');
        return;
      }
      const authHeaders = await getAdminHeaders();
      for (const path of [...cleanup.current]) {
        const row = await readAd(url, authHeaders, path.split('/')[0]);
        if (!row || row.media_path !== path) await removeFile(path);
        else cleanup.current = cleanup.current.filter(p => p !== path);
      }
      if (!cleanup.current.length) setWarning('');
    } catch (e) { setWarning('Dosya temizlenemedi. ' + explain(e)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  return { items, loading, busy, error, saveError, success, warning, canCleanup: cleanup.current.length > 0, refresh, save, remove, retryCleanup, mediaUrl };
}