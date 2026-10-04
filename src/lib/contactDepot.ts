export const CHANNELS = ['sms','email','whatsapp'] as const;
export type MessageChannel = typeof CHANNELS[number];
export type Permission = {status:'unknown'|'granted'|'revoked';evidence:string;updated_at:string|null};
export type DepotContact = {
  id:string;name:string;email:string|null;phone:string|null;raw_phone:string|null;
  from_listing:boolean;manual:boolean;listing_count:number;archived:boolean;revision:number;
  created_at:string;updated_at:string;permissions:Record<MessageChannel,Permission>;
};
export type ContactDraft = {id:string|null;revision:number|null;name:string;email:string;phone:string};
export type Campaign = {
  id:string;name:string;channel:MessageChannel;subject:string;body:string;scheduled_at:string;
  status:'blocked_provider'|'queued'|'completed'|'cancelled';created_at:string;
  recipients:number;sent:number;cancelled:number;failed:number;unknown:number;
};
export type DepotPage = {
  contacts:DepotContact[];total:number;page:number;page_size:number;
  campaigns:Campaign[];channels:{channel:MessageChannel;provider:string|null;enabled:boolean}[];
};
export type CampaignDraft = {
  name:string;channel:MessageChannel;subject:string;body:string;scheduled_at:string;
};
export const channelLabel = (channel:MessageChannel)=>({sms:'SMS',email:'E-posta',whatsapp:'WhatsApp'}[channel]);
export function normalizePhone(value:string):string|null {
  if(!/^[+0-9 ()-]*$/.test(value))return null;
  let phone=value.replace(/[ ()-]/g,'');
  if(/^00/.test(phone))phone='+'+phone.slice(2);
  if(/^0[1-9]\d{9}$/.test(phone))phone='+90'+phone.slice(1);
  else if(/^[1-9]\d{9}$/.test(phone))phone='+90'+phone;
  else if(/^90[1-9]\d{9}$/.test(phone))phone='+'+phone;
  return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
export function validateContact(draft:ContactDraft) {
  if(!draft.name.trim()||draft.name.trim().length>120)throw Error('Ad/ünvan 1–120 karakter olmalı.');
  if(!draft.email.trim()&&!draft.phone.trim())throw Error('En az bir e-posta veya telefon girin.');
  if(draft.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))throw Error('Geçerli bir e-posta girin.');
  if(draft.phone.trim()&&!normalizePhone(draft.phone))throw Error('Geçerli telefon girin: 05xx xxx xx xx veya +ülke kodu.');
}
export function parseDepotPage(value:unknown):DepotPage {
  const v=value as DepotPage;
  const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f-]{36}$/i.test(x);
  const count=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
  const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
  if(!v||!count(v.total)||!count(v.page)||v.page_size!==50||!Array.isArray(v.contacts)||v.contacts.length>50||
    !v.contacts.every(c=>c&&uuid(c.id)&&typeof c.name==='string'&&
      [c.email,c.phone,c.raw_phone].every(s=>s===null||typeof s==='string')&&
      [c.manual,c.from_listing,c.archived].every(b=>typeof b==='boolean')&&count(c.listing_count)&&
      count(c.revision)&&date(c.created_at)&&date(c.updated_at)&&c.permissions&&
      CHANNELS.every(k=>['unknown','granted','revoked'].includes(c.permissions[k]?.status)&&
        typeof c.permissions[k].evidence==='string'&&(c.permissions[k].updated_at===null||date(c.permissions[k].updated_at))))||
    !Array.isArray(v.channels)||v.channels.length!==3||!CHANNELS.every(k=>v.channels.some(c=>c.channel===k&&
      typeof c.enabled==='boolean'&&(c.provider===null||typeof c.provider==='string')))||
    !Array.isArray(v.campaigns)||!v.campaigns.every(c=>c&&uuid(c.id)&&CHANNELS.includes(c.channel)&&
      ['name','subject','body'].every(k=>typeof c[k as 'name']==='string')&&date(c.scheduled_at)&&date(c.created_at)&&
      ['blocked_provider','queued','completed','cancelled'].includes(c.status)&&
      [c.recipients,c.sent,c.cancelled,c.failed,c.unknown].every(count)))throw Error('Kişi deposu geçerli veri döndürmedi.');
  return v;
}
export async function depotRpc(url:string,headers:Record<string,string>,name:string,args:unknown,request=fetch) {
  const response=await request(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),
    cache:'no-store',signal:AbortSignal.timeout(15_000)});
  if(!response.ok) {
    const failure=await response.json().catch(()=>({}));
    const messages:Record<string,string>={
      CONTACT_CONFLICT:'Aynı iletişim bilgileriyle başka kayıt var. Mevcut kaydı düzenleyin.',
      CONTACT_STALE:'Kayıt başka bir oturumda değişti. Yenileyip yeniden deneyin.',
      CONTACT_EVIDENCE_REQUIRED:'İzin vermeden önce onayın kaynağını/tarihini girin.',
      CONTACT_DESTINATION_REQUIRED:'Bu kanal için geçerli iletişim bilgisi gerekiyor.',
      CONTACT_NO_RECIPIENTS:'Bu kanalda izinli ve aktif alıcı yok.',
      CONTACT_INVALID:'Girdiğiniz bilgileri kontrol edin.',
      CONTACT_INVALID_UNSUBSCRIBE:'Çıkış bağlantısı geçersiz. Size gönderilen bağlantıyı kontrol edin.',
    };
    if(messages[failure.message])throw Error(messages[failure.message]);
    if(response.status===401||response.status===403)throw Error(name==='unsubscribe_depot_contact'
      ?'Çıkış bağlantısı şu an doğrulanamıyor. Site yöneticisine bildirin.'
      :'Bu işlem için yetkili yönetici girişi gerekiyor.');
    if(response.status===404)throw Error('Kişi deposu veritabanı kurulumu eksik.');
    throw Error('İşlem kaydedilemedi (HTTP '+response.status+'). Yenileyip durumu kontrol edin.');
  }
  return response.json();
}