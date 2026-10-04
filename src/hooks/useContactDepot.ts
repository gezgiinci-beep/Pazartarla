import {useCallback,useEffect,useRef,useState} from 'react';
import {depotRpc,parseDepotPage,validateContact} from '../lib/contactDepot';
import type {CampaignDraft,ContactDraft,DepotPage,MessageChannel} from '../lib/contactDepot';
export function useContactDepot(enabled:boolean,url:string,getHeaders:()=>Promise<Record<string,string>>) {
  const [data,setData]=useState<DepotPage|null>(null);
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),[archived,setArchived]=useState(false);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const sequence=useRef(0),lock=useRef(false),scope=useRef(0);
  const refresh=useCallback(async()=>{
    if(!enabled)return false;
    const n=++sequence.current;setLoading(true);setError('');
    try {
      const result=parseDepotPage(await depotRpc(url,await getHeaders(),'get_contact_depot',{
        p_search:search,p_page:page,p_archived:archived}));
      if(n!==sequence.current)return false;
      if(result.total>0&&page*50>=result.total){setPage(Math.ceil(result.total/50)-1);return false;}
      setData(result);return true;
    }catch(e){if(n===sequence.current){setData(null);setError(e instanceof Error?e.message:'Depo yüklenemedi.');}return false;}
    finally{if(n===sequence.current)setLoading(false);}
  },[enabled,url,getHeaders,search,page,archived]);
  useEffect(()=>{
    if(enabled)void refresh();
    else{setData(null);setError('');setNotice('');setLoading(false);}
    return()=>{++sequence.current;};
  },[refresh,enabled]);
  useEffect(()=>{++scope.current;},[enabled]);
  useEffect(()=>{
    if(!enabled)return;
    const visible=()=>{if(document.visibilityState==='visible'&&!lock.current)void refresh();};
    const timer=window.setInterval(visible,60_000);
    window.addEventListener('focus',visible);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',visible);};
  },[enabled,refresh]);
  async function mutate(name:string,args:unknown,message:string) {
    if(!enabled||lock.current)return false;
    const current=scope.current;lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      const ack=await depotRpc(url,await getHeaders(),name,args);
      if(ack!==true&&!(typeof ack==='string'&&/^[0-9a-f-]{36}$/.test(ack)))throw Error('Sunucu kaydı doğrulamadı. Yenileyip kontrol edin.');
      if(current!==scope.current)return false;
      setNotice(message);
      await refresh();return true;
    }catch(e){if(current===scope.current)setError(e instanceof Error?e.message:'İşlem tamamlanamadı.');return false;}
    finally{lock.current=false;setBusy(false);}
  }
  async function saveContact(draft:ContactDraft) {
    try{validateContact(draft);}catch(e){setError((e as Error).message);return false;}
    return mutate('save_depot_contact',{p_id:draft.id,p_revision:draft.revision,p_name:draft.name,
      p_email:draft.email,p_phone:draft.phone},'Kişi kaydedildi.');
  }
  return {data,loading,busy,error,notice,search,page,archived,refresh,
    searchContacts(value:string){setSearch(value);setPage(0);},
    setPage,
    showArchived(value:boolean){setArchived(value);setPage(0);},
    saveContact,
    archiveContact:(id:string,revision:number,value:boolean)=>mutate('archive_depot_contact',
      {p_id:id,p_revision:revision,p_archived:value},value?'Kişi arşivlendi; mesaj izinleri kapatıldı.':'Kişi yeniden aktif. Önceki kapalı izinler açılmadı.'),
    savePermission:(id:string,revision:number,channel:MessageChannel,grant:boolean,evidence:string)=>mutate(
      'set_depot_permission',{p_id:id,p_revision:revision,p_channel:channel,p_grant:grant,p_evidence:evidence},
      grant?'İzin ve onay kaynağı kaydedildi.':'İzin kapatıldı; bekleyen mesajlar iptal edildi.'),
    createCampaign:(draft:CampaignDraft)=>mutate('queue_depot_campaign',{
      p_name:draft.name,p_channel:draft.channel,p_subject:draft.subject,p_body:draft.body,p_scheduled_at:draft.scheduled_at
    },'Kampanya kaydedildi. Sağlayıcı bağlanıp etkinleştirilmeden mesaj gönderilmez.'),
    cancelCampaign:(id:string)=>mutate('cancel_depot_campaign',{p_id:id},'Kampanya iptal edildi. Başlamış gönderimler geri alınamaz.'),
  };
}