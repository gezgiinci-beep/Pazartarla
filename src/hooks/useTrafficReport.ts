import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSearchConsoleReport, type SearchConsolePeriod, type SearchConsoleReport } from '../lib/searchConsole';

const API_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function useTrafficReport(
  enabled: boolean,
) {
  const [days, setDays] = useState<SearchConsolePeriod>(7);
  const [data, setData] = useState<SearchConsoleReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++sequence.current;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const response = await fetch(`${API_BASE}/api/traffic?days=${days}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Search Console raporunu görüntüleme yetkiniz yok. Yönetici hesabıyla yeniden giriş yapın.');
      }
      if (!response.ok) throw new Error('Google Search Console raporu alınamadı. Biraz sonra yeniden deneyin.');
      const report = parseSearchConsoleReport(payload, days);
      if (id === sequence.current) setData(report);
    } catch (cause) {
      if (id === sequence.current) {
        setError(cause instanceof Error ? cause.message : 'Google Search Console bağlantısı kurulamadı.');
      }
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [enabled, days]);

  useEffect(() => {
    if (enabled) void refresh();
    else {
      ++sequence.current;
      setData(null);
      setError('');
      setLoading(false);
    }
    return () => { ++sequence.current; };
  }, [enabled, refresh]);

  return { data, loading, error, days, setDays, refresh };
}