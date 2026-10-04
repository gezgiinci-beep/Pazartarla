import { useEffect, useState } from 'react';
import { TRAFFIC_CONSENT_KEY, clearTrafficIdentity, startTrafficTracker } from '../lib/trafficTracking';
import type { ViewPayload } from '../lib/trafficTracking';
import type { TrafficRoute } from '../lib/trafficAnalytics';

function blocked() {
  return navigator.doNotTrack==='1' || (window as Window & {globalPrivacyControl?:boolean}).globalPrivacyControl===true;
}
function preference(): 'unknown'|'granted'|'denied' {
  if (typeof window==='undefined') return 'unknown';
  try {
    const value=localStorage.getItem(TRAFFIC_CONSENT_KEY);
    return value==='granted'||value==='denied'?value:'unknown';
  } catch { return 'unknown'; }
}
export function useTrafficAnalytics(tab: string, listingId: unknown, pageKey: string, admin: boolean) {
  const [consent,setConsent]=useState(preference);
  const [error,setError]=useState('');
  const isBlocked=typeof window!=='undefined' && blocked();
  const route=(['home','detail','favorites','add'].includes(tab)?tab:null) as TrafficRoute | null;
  const id=tab==='detail' && typeof listingId!=='undefined' && listingId!==null?String(listingId):null;
  useEffect(() => {
    const update=()=>setConsent(preference());
    window.addEventListener('storage',update);
    return ()=>window.removeEventListener('storage',update);
  },[]);
  function choose(allow: boolean) {
    try {
      localStorage.setItem(TRAFFIC_CONSENT_KEY,allow?'granted':'denied');
      if (!allow) clearTrafficIdentity(localStorage);
      setConsent(allow?'granted':'denied');setError('');
    } catch { setError('İzin tercihi kaydedilemedi. Bu tarayıcıda ölçüm yapılmayacak.');setConsent('denied'); }
  }
  useEffect(() => {
    if (consent!=='granted' || isBlocked || admin || !route || (route==='detail'&&!id)) return;
    let mounted=true;
    const endpoint=import.meta.env.BASE_URL+'api/traffic';
    const send=async(payload:ViewPayload,final:boolean) => {
      const body=JSON.stringify(payload);
      if (final && navigator.sendBeacon?.(endpoint,body)) return;
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
        body,keepalive:final,signal:AbortSignal.timeout(8_000)});
      if (!response.ok || (await response.json()).recorded!==true) throw new Error('View not acknowledged');
      if (mounted) setError('');
    };
    const stop=startTrafficTracker({
      route,listingId:id,storage:localStorage,uuid:()=>crypto.randomUUID(),now:Date.now,
      clock:()=>performance.now(),visible:()=>document.visibilityState==='visible'&&document.hasFocus(),
      allowed:()=>preference()==='granted'&&!blocked(),send,onError:message=>{if(mounted)setError(message);},
      schedule:(fn,ms)=>window.setTimeout(fn,ms),repeat:(fn,ms)=>window.setInterval(fn,ms),
      cancelSchedule:window.clearTimeout.bind(window),cancelRepeat:window.clearInterval.bind(window),
      listen(fn,onHide) {
        document.addEventListener('visibilitychange',fn);
        window.addEventListener('focus',fn);window.addEventListener('blur',fn);window.addEventListener('pagehide',onHide);
        window.addEventListener('pageshow',fn);
        return ()=>{document.removeEventListener('visibilitychange',fn);
          window.removeEventListener('focus',fn);window.removeEventListener('blur',fn);window.removeEventListener('pagehide',onHide);
          window.removeEventListener('pageshow',fn);};
      }
    });
    return ()=>{mounted=false;stop();};
  },[consent,isBlocked,admin,route,id,pageKey]);
  return {consent,error,isBlocked,choose};
}