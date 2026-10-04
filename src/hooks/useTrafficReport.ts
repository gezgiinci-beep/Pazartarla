import { useCallback, useEffect, useRef, useState } from 'react';
import { readTrafficReport } from '../lib/trafficAnalytics';
import type { TrafficPeriod, TrafficReport } from '../lib/trafficAnalytics';

export function useTrafficReport(enabled: boolean, url: string, getHeaders: () => Promise<Record<string,string>>) {
  const [days,setDays] = useState<TrafficPeriod>(7);
  const [data,setData] = useState<TrafficReport | null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [collectorError,setCollectorError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++sequence.current;
    setLoading(true);setError('');setCollectorError('');setData(null);
    try {
      const headers = await getHeaders();
      const [report,collector] = await Promise.all([
        readTrafficReport(url,headers,days),
        fetch(import.meta.env.BASE_URL+'api/traffic',{cache:'no-store',signal:AbortSignal.timeout(8_000)})
          .then(async r => { if (!r.ok || (await r.json()).ready !== true) throw new Error(); })
          .catch(() => 'Ziyaret ölçüm bağlantısı çalışmıyor veya bu sürüm henüz yayınlanmadı. Veri toplama eksik olabilir.')
      ]);
      if (id !== sequence.current) return;
      setData(report);
      setCollectorError(typeof collector === 'string' ? collector : '');
    } catch (e) {
      if (id === sequence.current) setError(e instanceof Error ? e.message : 'İstatistik bağlantısı kesildi.');
    } finally { if (id === sequence.current) setLoading(false); }
  },[enabled,url,getHeaders,days]);
  useEffect(() => {
    if (enabled) void refresh();
    else { setData(null);setError('');setCollectorError('');setLoading(false); }
    return () => { ++sequence.current; };
  },[enabled,refresh]);
  return {data,loading,error,collectorError,days,setDays,refresh};
}