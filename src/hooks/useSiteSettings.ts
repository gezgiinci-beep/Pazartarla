import { useCallback, useEffect, useRef, useState } from 'react';
import { readSiteSettings, writeSiteSettings, SettingsConflictError } from '../lib/siteSettings';
import type { SettingsPatch, SiteSettings } from '../lib/siteSettings';

function message(error: unknown, prefix: string) {
  return prefix + (error instanceof Error ? error.message : 'Bağlantı kesildi. Lütfen yeniden deneyin.');
}

export function useSiteSettings(url: string, key: string, getAdminHeaders: () => Promise<Record<string, string>>) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const current = useRef<SiteSettings | null>(null);
  const savingLock = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (savingLock.current) return null;
    const id = ++requestId.current;
    if (!current.current) setLoading(true);
    try {
      const row = await readSiteSettings(url, key);
      if (!mounted.current || id !== requestId.current) return null;
      if (!current.current || row.revision >= current.current.revision) {
        current.current = row;
        setSettings(row);
      }
      setLoadError('');
      return row;
    } catch (error) {
      if (mounted.current && id === requestId.current) {
        setLoadError(message(error, 'Duyuru ve kategoriler yüklenemedi. '));
      }
      return null;
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshVisible, 60_000);
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
    if (!current.current || loading || loadError) {
      setSaveError('Önce güncel site ayarlarını yükleyin; değişiklik kaydedilmedi.');
      return null;
    }
    savingLock.current = true;
    ++requestId.current; // A pending read must not overwrite the acknowledged write.
    setSaving(true);
    setSaveError('');
    setSuccess('');
    let conflict = false;
    try {
      const headers = await getAdminHeaders().catch(() => {
        throw new Error('Kaydetmek için yetkili yönetici hesabıyla tekrar giriş yapın.');
      });
      const row = await writeSiteSettings(url, headers, expectedRevision ?? current.current.revision, patch);
      if (mounted.current) {
        current.current = row;
        setSettings(row);
        setLoadError('');
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

  return { settings, loading, saving, loadError, saveError, success, refresh, save,
    editable: !!settings && !loading && !saving && !loadError };
}