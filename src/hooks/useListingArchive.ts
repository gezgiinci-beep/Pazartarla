import { useCallback, useEffect, useRef, useState } from 'react';
export type ArchivedListing = {
  id: number; title: string; created_at: string; expires_at: string; status: string;
};
const PAGE_SIZE = 50;
export function useListingArchive(enabled: boolean, url: string, getHeaders: () => Promise<Record<string, string>>) {
  const [items, setItems] = useState<ArchivedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const active = useRef(enabled);
  active.current = enabled;
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  const count = useRef(0);
  const load = useCallback(async (more = false) => {
    if (!enabled) return;
    const n = ++sequence.current;
    const offset = more ? count.current : 0;
    setLoading(true); setError('');
    try {
      const response = await fetch(`${url}/rest/v1/listing_archive?select=*&order=expires_at.desc,id.desc&limit=${PAGE_SIZE + 1}&offset=${offset}`, {
        headers: await getHeaders(), cache: 'no-store', signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error('ARCHIVE_LOAD_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => !Number.isSafeInteger(row.id) || typeof row.title !== 'string' ||
        !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.expires_at)))) throw new Error('ARCHIVE_LOAD_FAILED');
      if (active.current && sequence.current === n) {
        const page = rows.slice(0, PAGE_SIZE);
        setItems(previous => more ? [...previous, ...page.filter(row => !previous.some(item => item.id === row.id))] : page);
        count.current = offset + page.length;
        setHasMore(rows.length > PAGE_SIZE);
      }
    } catch {
      if (active.current && sequence.current === n) setError('İlan arşivi yüklenemedi. Yönetici oturumunuzu ve bağlantınızı kontrol edip yeniden deneyin.');
    } finally {
      if (active.current && sequence.current === n) setLoading(false);
    }
  }, [enabled, url, getHeaders]);
  useEffect(() => {
    ++sequence.current; ++detailSequence.current; count.current = 0;
    setItems([]); setError(''); setHasMore(false); setLoading(false); setBusyId(null);
    if (!enabled) return;
    void load();
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(visible, 60_000);
    window.addEventListener('focus', visible);
    return () => { ++sequence.current; ++detailSequence.current; window.clearInterval(timer); window.removeEventListener('focus', visible); };
  }, [enabled, load]);
  const view = async (id: number) => {
    if (!enabled || busyId !== null) return null;
    const n = ++detailSequence.current;
    setBusyId(id); setError('');
    try {
      const response = await fetch(`${url}/rest/v1/listings?id=eq.${id}&select=*`, {
        headers: await getHeaders(), cache: 'no-store', signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error('ARCHIVE_DETAIL_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== id) throw new Error('ARCHIVE_DETAIL_FAILED');
      return active.current && detailSequence.current === n ? rows[0] : null;
    } catch {
      if (active.current && detailSequence.current === n) setError('Arşivdeki ilan açılamadı. Oturumunuzu kontrol edip yeniden deneyin.');
      return null;
    } finally { if (active.current && detailSequence.current === n) setBusyId(null); }
  };
  return { items, loading, error, hasMore, busyId, refresh: () => load(), loadMore: () => load(true), view };
}