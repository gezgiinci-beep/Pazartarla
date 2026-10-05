import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session,SupabaseClient} from '@supabase/supabase-js';
import {parseStoreData,storeRpc,getStoreMembershipData} from '../lib/storeMembership';
import {membershipContextKey,membershipDataForContext,type MembershipSnapshot} from '../lib/membershipAccess';
export function useStoreMembership(client:SupabaseClient|null,url:string,key:string,session:Session|null,admin:boolean,storeId:string|null){
  const context=membershipContextKey(session?.user.id,admin,storeId);
  const currentContext=useRef(context);
  currentContext.current=context;
  const [snapshot,setSnapshot]=useState<MembershipSnapshot|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const data=membershipDataForContext(snapshot,context);
  const [error,setError]=useState(''),[actionError,setActionError]=useState(''),[message,setMessage]=useState('');
  const generation=useRef(0),readSequence=useRef(0),locked=useRef(false);
  const headers=useCallback(async()=>{
    if(!client)return {apikey:key};
    const {data,error}=await client.auth.getSession();
    if(error)throw Error('Oturum doğrulanamadı.');
    if(data.session?.user.id!==session?.user.id)throw Error('Oturum değişti. Yeni oturumun yüklenmesini bekleyip yeniden deneyin.');
    return {apikey:key,...(data.session?{Authorization:'Bearer '+data.session.access_token}:{})};
  },[client,key,session?.user.id,session?.access_token]);
  const refresh=useCallback(async()=>{
    const n=generation.current,sequence=++readSequence.current;
    try{const next=parseStoreData(await getStoreMembershipData(url,await headers(),storeId));if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence){setSnapshot({context,data:next});setError('');}}
    catch(e){if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence)setError(e instanceof Error?e.message:'Mağazalar yüklenemedi.');}
    finally{if(currentContext.current===context&&generation.current===n&&readSequence.current===sequence)setLoading(false);}
  },[url,headers,storeId,context]);
  useEffect(()=>{
    ++generation.current;setSnapshot(null);setLoading(true);setBusy(false);setError('');setActionError('');setMessage('');void refresh();
    const visible=()=>{if(document.visibilityState==='visible'&&!locked.current)void refresh();};
    const timer=setInterval(visible,60000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[refresh,admin]);
  const action=async(action:string,id:string|null,revision:number|null,payload:Record<string,unknown>)=>{
    if(locked.current||currentContext.current!==context)return false;
    locked.current=true;const n=generation.current;setBusy(true);setActionError('');setMessage('');
    try{
      const result=await storeRpc(url,await headers(),action==='trial_start'?'start_store_trial':'manage_store_membership',{p_action:action,p_id:id,p_revision:revision,p_payload:payload});
      if(!result||result.ok!==true)throw Error('İşlem sunucudan doğrulanamadı.');
      if(currentContext.current!==context||generation.current!==n)return false;
      setMessage(action==='trial_start'?'30 günlük ücretsiz denemeniz başladı. Süre sonunda otomatik ücretlendirme yapılmaz.':
        action==='request'?'Talebiniz kaydedildi. Paketiniz, ödeme doğrulanıp yönetici onayı verildiğinde açılır.':'Değişiklik sunucudan doğrulandı.');
      await refresh();return true;
    }catch(e){if(currentContext.current===context&&generation.current===n){setActionError(e instanceof Error?e.message:'İşlem tamamlanamadı.');await refresh();}return false;}
    finally{locked.current=false;if(currentContext.current===context&&generation.current===n)setBusy(false);}
  };
  return {data,loading,busy,error,actionError,message,refresh,action};
}