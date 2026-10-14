import { useCallback, useEffect, useRef, useState } from 'react';
import { readSiteSettings, writeSiteSettings, SettingsConflictError } from '../lib/siteSettings';
import { AUTOMATIC_REFRESH_INTERVAL_MS, automaticRefreshDue } from '../lib/refreshPolicy.mjs';
import {
  backoffDelayMs,
  readCachedValue,
  readRetryAt,
  writeCachedValue,
  writeRetryAt,
} from '../lib/publicReadResilience.mjs';
import type { SettingsPatch, SiteSettings } from '../lib/siteSettings';
import type { SettingsBackend } from '../lib/siteSettings';
import { parseSiteSettings } from '../lib/siteSettings';

const PUBLIC_SETTINGS_CACHE_KEY = 'pazartarla-public-site-settings-v1';
const PUBLIC_SETTINGS_RETRY_KEY = 'pazartarla-public-site-settings-retry-at-v1';
const PUBLIC_SETTINGS_CACHE_TTL_MS = 24 * 60 * 60_000;

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

function message(error: unknown, prefix: string) {
  return prefix + (error instanceof Error ? error.message : 'Bağlantı kesildi. Lütfen yeniden deneyin.');
}

export function useSiteSettings(
  url: string,
  key: string,
  getAdminHeaders: () => Promise<Record<string, string>>,
  backend: SettingsBackend = 'supabase',
  writeBackend: SettingsBackend = backend
) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const current = useRef<SiteSettings | null>(null);
  const savingLock = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const lastRefreshAt = useRef(0);
  const failureCount = useRef(0);
  const retryAt = useRef(0);

  const refresh = useCallback(async () => {
    if (savingLock.current) return null;
    if (Date.now() < retryAt.current) return null;
    lastRefreshAt.current = Date.now();
    const id = ++requestId.current;
    if (!current.current) setLoading(true);
    try {
      const row = await readSiteSettings(url, key, fetch, backend);
      if (!mounted.current || id !== requestId.current) return null;
      if (!current.current || row.revision >= current.current.revision) {
        current.current = row;
        setSettings(row);
      }
      writeCachedValue(browserStorage(), PUBLIC_SETTINGS_CACHE_KEY, row);
      failureCount.current = 0;
      retryAt.current = 0;
      try { browserStorage()?.removeItem(PUBLIC_SETTINGS_RETRY_KEY); } catch { /* Storage is optional. */ }
      setLoadError('');
      setLoadWarning('');
      return row;
    } catch (error) {
      if (mounted.current && id === requestId.current) {
        const retry = ++failureCount.current;
        const fallbackDelay = backoffDelayMs(retry, 15_000, 15 * 60_000);
        const serverDelay = Number((error as Error & { retryAfterMs?: number })?.retryAfterMs) || 0;
        retryAt.current = Date.now() + Math.min(60 * 60_000, Math.max(fallbackDelay, serverDelay));
        writeRetryAt(browserStorage(), PUBLIC_SETTINGS_RETRY_KEY, retryAt.current);
        if (current.current) {
          setLoadError('');
          setLoadWarning('Site ayarları çevrimdışı kopyadan gösteriliyor; güncelleme daha sonra yeniden denenecek.');
        } else {
          setLoadWarning('');
          setLoadError(backend === 'turso'
            ? 'Site ayarları geçici olarak yenilenemedi; yeniden deneme aralığı uzatıldı.'
            : message(error, 'Site ayarları yüklenemedi. '));
        }
      }
      return null;
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [url, key, backend]);

  useEffect(() => {
    mounted.current = true;
    const storage = browserStorage();
    const cached = readCachedValue(storage, PUBLIC_SETTINGS_CACHE_KEY, PUBLIC_SETTINGS_CACHE_TTL_MS,
      value => { try { parseSiteSettings(value); return true; } catch { return false; } });
    if (cached) {
      current.current = cached;
      setSettings(cached);
      setLoading(false);
    }
    retryAt.current = readRetryAt(storage, PUBLIC_SETTINGS_RETRY_KEY);
    if (retryAt.current > Date.now()) {
      if (!cached) {
        setLoading(false);
        setLoadError('Site ayarları geçici olarak yüklenemiyor; yeniden deneme aralığı bekleniyor.');
      }
    } else {
      void refresh();
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && automaticRefreshDue(lastRefreshAt.current)) void refresh();
    };
    const interval = window.setInterval(refreshVisible, AUTOMATIC_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      mounted.current = false;
      ++requestId.current;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [refresh]);

  const save = async (patch: SettingsPatch, successMessage: string, expectedRevision?: number) => {
    if (savingLock.current) return null;
    if (backend !== writeBackend) {
      setSaveError('Site ayarları şu anda salt okunur gösteriliyor; değişiklik kaydedilmedi.');
      return null;
    }
    if (!current.current || loading || loadError) {
      setSaveError('Önce güncel site ayarlarını yükleyin; değişiklik kaydedilmedi.');
      return null;
    }
    if (loadWarning) {
      setSaveError('Önce güncel site ayarlarını sunucudan doğrulayın; değişiklik kaydedilmedi.');
      return null;
    }
    savingLock.current = true;
    ++requestId.current; // A pending read must not overwrite the acknowledged write.
    setSaving(true);
    setSaveError('');
    setSuccess('');
    let conflict = false;
    try {
      const headers = writeBackend === 'turso'
        ? {}
        : await getAdminHeaders().catch(() => {
          throw new Error('Kaydetmek için yetkili yönetici hesabıyla tekrar giriş yapın.');
        });
      const row = await writeSiteSettings(
        url,
        headers,
        expectedRevision ?? current.current.revision,
        patch,
        fetch,
        writeBackend,
      );
      if (mounted.current) {
        current.current = row;
        setSettings(row);
        writeCachedValue(browserStorage(), PUBLIC_SETTINGS_CACHE_KEY, row);
        setLoadError('');
        setLoadWarning('');
        setSuccess(successMessage);
      }
      return row;
    } catch (error) {
      conflict = error instanceof SettingsConflictError;
      if (mounted.current) setSaveError(message(error, 'Değişiklik kaydedilemedi. '));
      return null;
    } finally {
      savingLock.current = false;
      if (mounted.current) {
        setSaving(false);
        if (conflict) void refresh();
      }
    }
  };

  return { settings, loading, saving, loadError, loadWarning, saveError, success, refresh, save,
    editable: !!settings && !loading && !saving && !loadError && !loadWarning && backend === writeBackend };
}