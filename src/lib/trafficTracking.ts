import type { TrafficRoute } from './trafficAnalytics';
export const TRAFFIC_CONSENT_KEY = 'pazartarla.traffic.consent.v1';
export const VISITOR_KEY = 'pazartarla.traffic.browser.v1';
export const SESSION_KEY = 'pazartarla.traffic.session.v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type StoragePort = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type ViewPayload = {
  view_id: string; visitor_id: string; session_id: string;
  route: TrafficRoute; listing_id: string | null; active_seconds: number;
};
export function browserIdentity(storage: StoragePort, now: number, uuid: () => string) {
  const read = (key: string) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
  };
  let visitor = read(VISITOR_KEY);
  if (!visitor || !uuidPattern.test(visitor.id) || !Number.isFinite(visitor.expires) || visitor.expires<=now) {
    visitor = {id:uuid(),expires:now+90*86400_000};
    storage.setItem(VISITOR_KEY,JSON.stringify(visitor));
  }
  let session = read(SESSION_KEY);
  if (!session || !uuidPattern.test(session.id) || session.visitor!==visitor.id ||
    !Number.isFinite(session.lastActive) || now-session.lastActive>=30*60_000 || now<session.lastActive) {
    session={id:uuid(),visitor:visitor.id,lastActive:now};
  }
  session.lastActive=now;
  storage.setItem(SESSION_KEY,JSON.stringify(session));
  return {visitor_id:visitor.id,session_id:session.id};
}
export function clearTrafficIdentity(storage: StoragePort) {
  storage.removeItem(VISITOR_KEY);storage.removeItem(SESSION_KEY);
}
export function startTrafficTracker({
  route,listingId,storage,uuid,now,clock,visible,allowed,send,onError,
  schedule,repeat,cancelSchedule,cancelRepeat,listen
}: {
  route: TrafficRoute; listingId: string | null; storage: StoragePort;
  uuid: () => string; now: () => number; clock: () => number;
  visible: () => boolean; allowed: () => boolean;
  send: (payload: ViewPayload, final: boolean) => Promise<void>;
  onError: (message: string) => void;
  schedule: (callback:()=>void,ms:number)=>number; repeat: (callback:()=>void,ms:number)=>number;
  cancelSchedule:(id:number)=>void;cancelRepeat:(id:number)=>void;
  listen: (callback:()=>void,onPageHide:()=>void)=>()=>void;
}) {
  let disposed=false, started=false, view: ViewPayload | null=null, activeMs=0, last=clock();
  let wasVisible=false, lastSent=-1, lastHeartbeat=clock();
  function flush(final=false) {
    if (!view || !allowed() || disposed) return;
    const seconds=Math.min(43200,Math.floor(activeMs/1000));
    if (!final && seconds===lastSent) return;
    lastSent=seconds;
    void send({...view,active_seconds:seconds},final).catch(() => {
      if (disposed) return;
      lastSent=-1;onError('İstatistik ölçümü şu an gönderilemiyor. Siteyi kullanmaya devam edebilirsiniz.');
    });
  }
  function sample() {
    if (disposed || !started) return;
    const current=clock(), isVisible=allowed()&&visible();
    if (wasVisible && allowed()) activeMs+=Math.max(0,Math.min(20_000,current-last));
    last=current;
    if (isVisible) {
      try {
        const ids=browserIdentity(storage,now(),uuid);
        if (!view || view.visitor_id!==ids.visitor_id || view.session_id!==ids.session_id) {
          flush(true);
          view={view_id:uuid(),...ids,route,listing_id:listingId,active_seconds:0};
          activeMs=0;lastSent=-1;flush();lastHeartbeat=current;
        }
      } catch {
        onError('Tarayıcı saklama alanı kullanılamıyor; istatistik ölçümü durduruldu.');
        wasVisible=false;view=null;return;
      }
    }
    if (!isVisible && wasVisible) flush(true);
    if (isVisible && current-lastHeartbeat>=15_000) { flush();lastHeartbeat=current; }
    wasVisible=isVisible;
  }
  // Deferral prevents React development StrictMode from counting a discarded mount.
  const start=schedule(()=>{started=true;sample();},0);
  const timer=repeat(sample,5_000);
  const unlisten=listen(sample,()=>{sample();flush(true);wasVisible=false;});
  return () => {
    if (disposed) return;
    sample();flush(true);disposed=true;
    cancelSchedule(start);cancelRepeat(timer);unlisten();
  };
}