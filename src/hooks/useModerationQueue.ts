import { useCallback, useEffect, useRef, useState } from 'react';
import { isListingArchived } from '../lib/listingLifetime';
import {readModerationRows,saveModerationSnapshot} from '../lib/moderationRequests';

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
      const response = await fetch(`${url}/rest/v1/rpc/get_listing_moderation_queue`, {
        method:'POST',body:'{}',headers: await getHeaders(), cache: 'no-store',
      });
      if (!response.ok) throw new Error('MODERATION_LOAD_FAILED');
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
      await saveModerationSnapshot(url,await getHeaders(),id,decision,token);
      if (active.current) setItems(current => current.filter(item => item.id !== id));
      await refresh();
      return true;
    } catch {
      if (active.current) setError('Karar kaydedilemedi. İlan değişmiş veya sunucu güncellemesi eksik olabilir; listeyi yenileyip güncel içeriği yeniden inceleyin.');
      return false;
    } finally {
      decisionInFlight.current = false;
      if (active.current) setBusyId(null);
    }
  };

  return { items, loading, error, busyId, refresh, decide };
}