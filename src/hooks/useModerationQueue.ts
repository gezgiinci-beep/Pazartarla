import { useCallback, useEffect, useRef, useState } from 'react';

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
      const response = await fetch(`${url}/rest/v1/listings?select=*&status=eq.pending&order=created_at.asc`, {
        headers: await getHeaders(), cache: 'no-store',
      });
      if (!response.ok) throw new Error('MODERATION_LOAD_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('MODERATION_LOAD_FAILED');
      if (active.current) setItems(rows.map(normalize));
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

  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    if (!enabled || decisionInFlight.current) return false;
    decisionInFlight.current = true;
    setBusyId(id); setError('');
    try {
      const response = await fetch(`${url}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
        method: 'PATCH',
        headers: { ...(await getHeaders()), Prefer: 'return=representation' },
        body: JSON.stringify({ status: decision }),
      });
      if (!response.ok) throw new Error('MODERATION_SAVE_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('MODERATION_SAVE_FAILED');
      if (active.current) setItems(current => current.filter(item => item.id !== id));
      await refresh();
      return true;
    } catch {
      if (active.current) setError('Karar kaydedilemedi. İlan başka bir yönetici tarafından işlenmiş olabilir; listeyi yenileyin.');
      return false;
    } finally {
      decisionInFlight.current = false;
      if (active.current) setBusyId(null);
    }
  };

  return { items, loading, error, busyId, refresh, decide };
}