import { useCallback, useEffect, useRef, useState } from 'react';
import { isListingArchived } from '../lib/listingLifetime';
import {readModerationRows,saveModerationSnapshot} from '../lib/moderationRequests';

const TURSO_AUTH_ENABLED = import.meta.env.VITE_AUTH_BACKEND === 'turso';
const API_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

async function responseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({}));
  return new Error(String(payload?.error || `HTTP_${response.status}`));
}

export function useModerationQueue(enabled: boolean, url: string, getHeaders: () => Promise<Record<string, string>>, normalize: (row: any) => any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const active = useRef(enabled);
  active.current = enabled;
  const decisionInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const response = TURSO_AUTH_ENABLED
        ? await fetch(`${API_BASE}/api/listing-moderation`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        : await fetch(`${url}/rest/v1/rpc/get_listing_moderation_queue`, {
          method:'POST',body:'{}',headers: await getHeaders(), cache: 'no-store',
        });
      if (!response.ok) throw await responseError(response);
      const rows = await response.json();
      const normalized=readModerationRows(rows,normalize);
      if (active.current) setItems(normalized.filter(row => !isListingArchived(row)));
    } catch {
      if (active.current) setError('Bekleyen ilanlar yüklenemedi. Yönetici oturumunuzu kontrol edip yeniden deneyin.');
    } finally { if (active.current) setLoading(false); }
  }, [enabled, url, getHeaders, normalize]);

  useEffect(() => {
    if (!enabled) { setItems([]); setError(''); setBusyId(null); }
    void refresh();
    if (!enabled) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(onVisible, 60_000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, enabled]);

  const decide = async (id: number, decision: 'approved' | 'rejected', token: string) => {
    if (!enabled || decisionInFlight.current) return false;
    decisionInFlight.current = true;
    setBusyId(id); setError('');
    try {
      if (TURSO_AUTH_ENABLED) {
        const response = await fetch(`${API_BASE}/api/listing-moderation`, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ id, decision, edit_token: token }),
        });
        if (!response.ok) throw await responseError(response);
      } else {
        await saveModerationSnapshot(url,await getHeaders(),id,decision,token);
      }
      if (active.current) setItems(current => current.filter(item => item.id !== id));
      await refresh();
      return true;
    } catch (error) {
      const code = String((error as Error)?.message || '');
      if (active.current) setError(code === 'LISTING_ADMIN_REAUTH_REQUIRED'
        ? 'Yönetici doğrulaması zaman aşımına uğradı. Yeniden yönetici girişi yapın.'
        : 'Karar kaydedilemedi. İlan değişmiş veya sunucu güncellemesi eksik olabilir; listeyi yenileyip güncel içeriği yeniden inceleyin.');
      return false;
    } finally {
      decisionInFlight.current = false;
      if (active.current) setBusyId(null);
    }
  };

  return { items, loading, error, busyId, refresh, decide };
}