export type PlanTerms={billing_period?:'month'|'year'|'trial';trial_days?:number|null;monthly_price_try:number|null;annual_price_try?:number|null;monthly_limit:number|null;active_limit:number|null};
export type StorePlan=PlanTerms&{id:string;name:string};
export type MemberStore={id:string;name:string;description:string;revision:number;listing_ids:number[]};
export type StoreRequest=PlanTerms&{id:string;revision:number;plan_id:string;plan_name:string;status:'pending'|'approved'|'rejected';created_at:string;email?:string;store_name:string};
export type Membership={plan_name:string;billing_period?:'month'|'year'|'trial';trial_days?:number|null;monthly_limit:number|null;active_limit:number|null;starts_at:string;ends_at:string;revision:number};
export type StoreData={plans:StorePlan[];stores:MemberStore[];store:MemberStore|null;listings:any[];mine:{store:MemberStore|null;membership:Membership|null;requests:StoreRequest[];trial_used?:boolean}|null;requests:StoreRequest[]};
export const ANNUAL_STORE_PLAN:StorePlan={id:'package-3',name:'Paket 3',billing_period:'year',
  monthly_price_try:null,annual_price_try:2500,monthly_limit:null,active_limit:null};
export const TRIAL_STORE_PLAN:StorePlan={id:'trial-30-days',name:'30 Gün Ücretsiz Deneme',billing_period:'trial',
  trial_days:30,monthly_price_try:null,annual_price_try:null,monthly_limit:null,active_limit:null};
export function planPriceText(plan:PlanTerms){
  if(plan.billing_period==='trial'){
    if(plan.trial_days!==30||plan.monthly_price_try!==null||(plan.annual_price_try!==null&&plan.annual_price_try!==undefined))
      throw Error('Deneme paketi geçersiz.');
    return '30 gün ücretsiz';
  }
  const yearly=plan.billing_period==='year';
  const amount=yearly?plan.annual_price_try:plan.monthly_price_try;
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0)throw Error('Paket ücreti geçersiz.');
  return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(amount)+(yearly?' TL / yıl':' TL / ay');
}
export function planCapacityText(plan:Pick<PlanTerms,'monthly_limit'|'active_limit'>){
  return plan.monthly_limit===null&&plan.active_limit===null?'Sınırsız ilan · Sınırsız listeleme':
    `${plan.monthly_limit} gönderim / ay · ${plan.active_limit} eşzamanlı aktif ilan`;
}
// User-approved promotion, not a fabricated available backend plan.
export function storePlanChoices(plans:StorePlan[]){
  const choices=plans.map(plan=>({plan,available:true}));
  if(!plans.some(plan=>plan.id===ANNUAL_STORE_PLAN.id))choices.push({plan:ANNUAL_STORE_PLAN,available:false});
  if(!plans.some(plan=>plan.id===TRIAL_STORE_PLAN.id))choices.push({plan:TRIAL_STORE_PLAN,available:false});
  const order:Record<string,number>={'package-1':0,'package-2':1,'package-3':2,'trial-30-days':3};
  return choices.sort((a,b)=>(order[a.plan.id]??4)-(order[b.plan.id]??4));
}
export function parseStoreData(value:unknown):StoreData{
  const v=value as StoreData;
  const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
  const capacity=(r:any)=>r&&(r.billing_period==='trial'
    ?r.monthly_limit===null&&r.active_limit===null&&r.trial_days===30
    :(r.trial_days===undefined||r.trial_days===null)&&(r.billing_period==='year'
      ?r.monthly_limit===null&&r.active_limit===null
      :(r.billing_period===undefined||r.billing_period==='month')&&count(r.monthly_limit)&&count(r.active_limit)));
  const terms=(r:any)=>capacity(r)&&(r.billing_period==='trial'
    ?r.monthly_price_try===null&&(r.annual_price_try===null||r.annual_price_try===undefined)
    :r.billing_period==='year'
    ?r.monthly_price_try===null&&typeof r.annual_price_try==='number'&&Number.isFinite(r.annual_price_try)&&r.annual_price_try>0
    :typeof r.monthly_price_try==='number'&&Number.isFinite(r.monthly_price_try)&&r.monthly_price_try>0&&
      (r.annual_price_try===undefined||r.annual_price_try===null));
  const store=(s:any)=>s&&uuid(s.id)&&typeof s.name==='string'&&typeof s.description==='string'&&count(s.revision)&&Array.isArray(s.listing_ids)&&s.listing_ids.every(count);
  const req=(r:any)=>r&&uuid(r.id)&&count(r.revision)&&typeof r.plan_id==='string'&&typeof r.plan_name==='string'&&typeof r.store_name==='string'&&terms(r)&&['pending','approved','rejected'].includes(r.status)&&Number.isFinite(Date.parse(r.created_at));
   if(!v||!Array.isArray(v.plans)||!v.plans.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&terms(p)&&(p.id!=='package-3'||p.billing_period==='year')&&(p.id!=='trial-30-days'||p.billing_period==='trial'))||
      !Array.isArray(v.stores)||!v.stores.every(store)||(v.store!==null&&!store(v.store))||!Array.isArray(v.listings)||!v.listings.every(l=>l&&count(l.id)&&typeof l.title==='string'&&l.status==='approved')||
     !Array.isArray(v.requests)||!v.requests.every(req)||
     (v.mine!==null&&(!v.mine||(v.mine.trial_used!==undefined&&typeof v.mine.trial_used!=='boolean')||!Array.isArray(v.mine.requests)||!v.mine.requests.every(req)||(v.mine.store!==null&&!store(v.mine.store))||
       (v.mine.membership!==null&&(!count(v.mine.membership.revision)||!capacity(v.mine.membership)||typeof v.mine.membership.plan_name!=='string'||!Number.isFinite(Date.parse(v.mine.membership.starts_at))||!Number.isFinite(Date.parse(v.mine.membership.ends_at)))))))
    throw Error('Mağaza sunucusu geçerli veri döndürmedi.');
  return v;
}
const messages:Record<string,string>={
  MEMBERSHIP_ADMIN_REQUIRED:'Bu işlem için yönetici yetkisi gerekiyor.',
  MEMBERSHIP_VERIFIED_REQUIRED:'Önce hesabınıza giriş yapıp e-postanızı doğrulayın.',
   MEMBERSHIP_STALE:'Bu kayıt başka bir oturumda değişti veya işlendi. Taslağınızı koruyup güncel kaydı kontrol edin; eski sürümün üzerine yazılmadı.',
  MEMBERSHIP_INVALID:'Paket ve mağaza bilgilerini kontrol edin.',
  MEMBERSHIP_ACTIVE:'Üyelik halen aktif. Yeni dönem talebini süre dolduğunda gönderebilirsiniz.',
  MEMBERSHIP_PENDING:'Bekleyen talebiniz var. Yönetici onayını bekleyin.',
  MEMBERSHIP_PAYMENT_REQUIRED:'Onay için ödemenin doğrulandığını belirtin ve işlem referansını yazın.',
  MEMBERSHIP_ACTIVE_LIMIT:'Aktif ve onay bekleyen ilan sayınız bu paketin kapasitesini aşıyor. Mevcut ilanlar değiştirilmedi.',
  MEMBERSHIP_PAYMENT_USED:'Bu ödeme referansı daha önce kullanılmış. Aynı ödeme ikinci üyelik açamaz.',
  MEMBERSHIP_TRIAL_USED:'Bu hesabın 30 günlük ücretsiz deneme hakkı kullanıldı. Yeniden başlatılamaz; ücretli paketleri inceleyebilirsiniz.',
  MEMBERSHIP_TRIAL_DIRECT_ONLY:'Ücretsiz deneme için denemeyi başlat seçeneğini kullanın. Ödeme veya yönetici onayı gerekmez.',
};
export class StoreRpcError extends Error{
  status:number;
  code?:string;
  constructor(message:string,status:number,code?:string){super(message);this.name='StoreRpcError';this.status=status;this.code=code;}
}
export async function storeRpc(url:string,headers:Record<string,string>,name:string,args:unknown,request=fetch){
  if(!url)throw Error('Mağaza bağlantısı yapılandırılmamış.');
  const r=await request(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new StoreRpcError(messages[e.message]||([404].includes(r.status)?'Mağaza altyapısı kurulmamış. Güvenli kurulumun tamamlanması gerekiyor.':'Mağaza işlemi tamamlanamadı. Listeyi yenileyip yeniden deneyin.'),r.status,e.code);}
  return r.json();
}
export async function getStoreMembershipData(url:string,headers:Record<string,string>,storeId:string|null,request=fetch){
  try{return await storeRpc(url,headers,'get_store_membership_data_v3',{p_store_id:storeId},request);}
  catch(error){if(!(error instanceof StoreRpcError)||error.code!=='PGRST202'||error.status!==404)throw error;}
  try{return await storeRpc(url,headers,'get_store_membership_data_v2',{p_store_id:storeId},request);}
  catch(error){
    // Compatibility is restricted to a genuinely missing new RPC; never hide
    // authorization, quota, network, timeout or malformed-data failures.
    if(!(error instanceof StoreRpcError)||error.code!=='PGRST202'||error.status!==404)throw error;
    return storeRpc(url,headers,'get_store_membership_data',{p_store_id:storeId},request);
  }
}
export function storeIdFromUrl(href:string){try{const id=new URL(href).searchParams.get('magaza');return id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id:null;}catch{return null;}}