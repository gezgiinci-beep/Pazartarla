import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseStoreData,storeRpc,getStoreMembershipData} from '../lib/storeMembership';
import {membershipContextKey,membershipDataForContext,type MembershipSnapshot} from '../lib/membershipAccess';
import {AUTOMATIC_REFRESH_INTERVAL_MS,automaticRefreshDue} from '../lib/refreshPolicy.mjs';
import {isTursoAccountSession,type AccountSession} from '../lib/accountSession';

function apiPath(path:string, storeId:string|null){
  const base=import.meta.env.BASE_URL.replace(/\/$/,'');
  const suffix=storeId?`?store_id=${encodeURIComponent(storeId)}`:'';
  return `${base}${path}${suffix}`;
}
async function tursoRequest(path:string,body?:Record<string,unknown>){
  const response=await fetch(apiPath(path,null),{
    method:body?'POST':'GET',credentials:'include',cache:'no-store',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw Error(typeof result?.message==='string'?result.message:
    typeof result?.error==='string'?result.error:'Mağaza hesabı işlemi tamamlanamadı.');
  return result;
}
export function useStoreMembership(client:SupabaseClient|null,url:string,key:string,session:AccountSession|null,admin:boolean,storeId:string|null){
  const context=membershipContextKey(session?.user.id,admin,storeId);
  const currentContext=useRef(context);
  currentContext.current=context;
  const [snapshot,setSnapshot]=useState<MembershipSnapshot|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const data=membershipDataForContext(snapshot,context);
  const [error,setError]=useState(''),[actionError,setActionError]=useState(''),[message,setMessage]=useState('');
   const generation=useRef(0),readSequence=useRef(0),locked=useRef(false),lastRefreshAt=useRef(0);
  const headers=useCallback(async()=>{
    if(typeof key!=='string'||!key.trim())throw Error('Mağaza sunucusu için tarayıcı anahtarı eksik: VITE_SUPABASE_ANON_KEY veya SUPABASE_PUBLISHABLE_KEY ayarını kontrol edip siteyi yeniden derleyin.');
    if(!client)return {apikey:key};
    const {data,error}=await client.auth.getSession();
    if(error)throw Error('Oturum doğrulanamadı.');
    if(data.session?.user.id!==session?.user.id)throw Error('Oturum değişti. Yeni oturumun yüklenmesini bekleyip yeniden deneyin.');
    return {apikey:key,...(data.session?{Authorization:'Bearer '+data.session.access_token}:{})};
  },[client,key,session?.user.id,session?.access_token]);
  const refresh=useCallback(async()=>{
     lastRefreshAt.current=Date.now();
     const n=generation.current,sequence=++readSequence.current;
     try{
       const raw=isTursoAccountSession(session)
         ?await tursoRequest(apiPath('/api/store-membership-data',storeId))
         :await getStoreMembershipData(url,await headers(),storeId);
       const next=parseStoreData(raw);
       if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence){setSnapshot({context,data:next});setError('');}
     }
    catch(e){if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence)setError(e instanceof Error?e.message:'Mağazalar yüklenemedi.');}
    finally{if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence)setLoading(false);}
  },[url,headers,storeId,context,session]);
  useEffect(()=>{
     ++generation.current;lastRefreshAt.current=0;setSnapshot(null);setLoading(true);setBusy(false);setError('');setActionError('');setMessage('');void refresh();
     const visible=()=>{if(document.visibilityState==='visible'&&!locked.current&&automaticRefreshDue(lastRefreshAt.current))void refresh();};
     const timer=setInterval(visible,AUTOMATIC_REFRESH_INTERVAL_MS);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[refresh,admin]);
  const action=async(action:string,id:string|null,revision:number|null,payload:Record<string,unknown>)=>{
    if(locked.current||currentContext.current!==context)return false;
    locked.current=true;const n=generation.current;setBusy(true);setActionError('');setMessage('');
    try{
      const result=isTursoAccountSession(session)
        ?await tursoRequest(
          action==='store_publication'?'/api/store-membership/publication':'/api/store-membership/mutate',
          action==='store_publication'
            ?{p_id:id,p_revision:revision,p_is_public:payload.is_public}
            :{p_action:action,p_id:id,p_revision:revision,p_payload:payload},
        )
        :action==='store_publication'
          ?await storeRpc(url,await headers(),'set_store_publication',{p_id:id,p_revision:revision,p_is_public:payload.is_public})
          :await storeRpc(url,await headers(),action==='trial_start'?'start_store_trial':'manage_store_membership',{p_action:action,p_id:id,p_revision:revision,p_payload:payload});
      if(!result||result.ok!==true)throw Error('İşlem sunucudan doğrulanamadı.');
      if(action==='store_publication'&&(typeof payload.is_public!=='boolean'||result.is_public!==payload.is_public||!Number.isSafeInteger(result.revision)||result.revision<=(revision??0)))
        throw Error('Mağaza yayın durumu sunucudan doğrulanamadı.');
      if(currentContext.current!==context||generation.current!==n)return false;
      setMessage(action==='trial_start'?'30 günlük ücretsiz denemeniz başladı. Süre sonunda otomatik ücretlendirme yapılmaz.':
        action==='request'?'Talebiniz kaydedildi. Paketiniz, ödeme doğrulanıp yönetici onayı verildiğinde açılır.':
        action==='store_publication'?(payload.is_public?'Mağaza yayına alındı.':'Mağaza yayından kaldırıldı.'):'Değişiklik sunucudan doğrulandı.');
      await refresh();return true;
    }catch(e){if(currentContext.current===context&&generation.current===n){setActionError(e instanceof Error?e.message:'İşlem tamamlanamadı.');await refresh();}return false;}
    finally{locked.current=false;if(currentContext.current===context&&generation.current===n)setBusy(false);}
  };
  return {data,loading,busy,error,actionError,message,refresh,action};
}