export type StorePlan={id:string;name:string;monthly_price_try:number;monthly_limit:number;active_limit:number};
export type MemberStore={id:string;name:string;description:string;revision:number;listing_ids:number[]};
export type StoreRequest={id:string;revision:number;plan_id:string;plan_name:string;monthly_price_try:number;monthly_limit:number;active_limit:number;status:'pending'|'approved'|'rejected';created_at:string;email?:string;store_name:string};
export type Membership={plan_name:string;monthly_limit:number;active_limit:number;starts_at:string;ends_at:string;revision:number};
export type StoreData={plans:StorePlan[];stores:MemberStore[];store:MemberStore|null;listings:any[];mine:{store:MemberStore|null;membership:Membership|null;requests:StoreRequest[]}|null;requests:StoreRequest[]};
export function parseStoreData(value:unknown):StoreData{
  const v=value as StoreData;
  const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
  const store=(s:any)=>s&&uuid(s.id)&&typeof s.name==='string'&&typeof s.description==='string'&&count(s.revision)&&Array.isArray(s.listing_ids)&&s.listing_ids.every(count);
  const req=(r:any)=>r&&uuid(r.id)&&count(r.revision)&&typeof r.plan_id==='string'&&typeof r.plan_name==='string'&&typeof r.store_name==='string'&&Number.isFinite(r.monthly_price_try)&&count(r.monthly_limit)&&count(r.active_limit)&&['pending','approved','rejected'].includes(r.status)&&Number.isFinite(Date.parse(r.created_at));
   if(!v||!Array.isArray(v.plans)||!v.plans.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.monthly_price_try)&&p.monthly_price_try>0&&count(p.monthly_limit)&&count(p.active_limit))||
      !Array.isArray(v.stores)||!v.stores.every(store)||(v.store!==null&&!store(v.store))||!Array.isArray(v.listings)||!v.listings.every(l=>l&&count(l.id)&&typeof l.title==='string'&&l.status==='approved')||
     !Array.isArray(v.requests)||!v.requests.every(req)||
     (v.mine!==null&&(!v.mine||!Array.isArray(v.mine.requests)||!v.mine.requests.every(req)||(v.mine.store!==null&&!store(v.mine.store))||
       (v.mine.membership!==null&&(!count(v.mine.membership.revision)||!count(v.mine.membership.monthly_limit)||!count(v.mine.membership.active_limit)||typeof v.mine.membership.plan_name!=='string'||!Number.isFinite(Date.parse(v.mine.membership.starts_at))||!Number.isFinite(Date.parse(v.mine.membership.ends_at)))))))
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
};
export async function storeRpc(url:string,headers:Record<string,string>,name:string,args:unknown,request=fetch){
  if(!url)throw Error('Mağaza bağlantısı yapılandırılmamış.');
  const r=await request(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(messages[e.message]||([404].includes(r.status)?'Mağaza altyapısı kurulmamış. Güvenli kurulumun tamamlanması gerekiyor.':'Mağaza işlemi tamamlanamadı. Listeyi yenileyip yeniden deneyin.'));}
  return r.json();
}
export function storeIdFromUrl(href:string){try{const id=new URL(href).searchParams.get('magaza');return id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id:null;}catch{return null;}}