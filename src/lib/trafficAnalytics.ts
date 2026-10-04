export type TrafficPeriod = 7 | 30 | 90;
export type TrafficRoute = 'home' | 'detail' | 'favorites' | 'add';
export type TrafficReport = {
  period_days: TrafficPeriod; collection_started_at: string; window_start: string; generated_at: string;
  summary: {
    total_views: number; detail_views: number; unique_browsers: number; total_sessions: number;
    total_active_seconds: number; avg_session_seconds: number; visits_per_browser: number; returning_rate: number;
  };
  regions: {
    country: string | null; region: string | null; views: number; browsers: number; sessions: number;
    active_seconds: number; avg_session_seconds: number; visits_per_browser: number; share_percent: number;
  }[];
  region_count: number;
  daily: { day: string; views: number; sessions: number; active_seconds: number }[];
  listings: { listing_id: string; title: string; views: number; active_seconds: number; share_percent: number }[];
  listing_count: number;
};

export function parseTrafficReport(value: unknown): TrafficReport {
  const v = value as TrafficReport;
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const date = (d: unknown) => typeof d === 'string' && Number.isFinite(Date.parse(d));
  if (!v || ![7,30,90].includes(v.period_days) ||
    !date(v.collection_started_at) || !date(v.window_start) || !date(v.generated_at) ||
    !v.summary || typeof v.summary!=='object' || Array.isArray(v.summary) || !Object.values(v.summary).every(number) ||
    !['total_views','detail_views','unique_browsers','total_sessions','total_active_seconds',
      'avg_session_seconds','visits_per_browser','returning_rate'].every(k => k in v.summary) ||
    v.summary.returning_rate > 100 || !number(v.region_count) || !number(v.listing_count) ||
    !Array.isArray(v.regions) || v.regions.length > 50 ||
    !v.regions.every(r => r && (r.country === null || /^[A-Z]{2}$/.test(r.country)) &&
      (r.region === null || /^[A-Z0-9-]{1,12}$/.test(r.region)) &&
      [r.views,r.browsers,r.sessions,r.active_seconds,r.avg_session_seconds,r.visits_per_browser,r.share_percent].every(number) && r.share_percent <= 100) ||
    !Array.isArray(v.daily) || v.daily.length !== v.period_days ||
    !v.daily.every(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d.day) && date(d.day) &&
      new Date(d.day).toISOString().slice(0,10)===d.day && [d.views,d.sessions,d.active_seconds].every(number)) ||
    !Array.isArray(v.listings) || v.listings.length > 50 ||
    !v.listings.every(l => l && /^[1-9]\d{0,18}$/.test(l.listing_id) &&
      typeof l.title === 'string' && [l.views,l.active_seconds,l.share_percent].every(number) && l.share_percent <= 100)) {
    throw new Error('İstatistik sunucusu geçerli bir rapor döndürmedi.');
  }
  return v;
}

export async function readTrafficReport(
  url: string, headers: Record<string,string>, days: TrafficPeriod, request = fetch
) {
  if (![7,30,90].includes(days)) throw new Error('Geçersiz istatistik dönemi.');
  const response = await request(url.replace(/\/$/,'')+'/rest/v1/rpc/get_traffic_report', {
    method:'POST', headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({p_days:days}), cache:'no-store', signal:AbortSignal.timeout(15_000)
  });
  if (response.status === 401 || response.status === 403) throw new Error('İstatistikleri görmek için yetkili yönetici hesabıyla giriş yapın.');
  if (response.status === 404) throw new Error('İstatistik veritabanı kurulumu eksik.');
  if (!response.ok) throw new Error('İstatistikler yüklenemedi (HTTP '+response.status+'). Yeniden deneyin.');
  const report=parseTrafficReport(await response.json());
  if (report.period_days!==days) throw new Error('Sunucu seçilen dönem için rapor döndürmedi.');
  return report;
}

export function formatDuration(seconds: number) {
  const n = Math.round(seconds);
  return n >= 3600 ? `${Math.floor(n/3600)} sa ${Math.floor(n%3600/60)} dk` :
    n >= 60 ? `${Math.floor(n/60)} dk ${n%60} sn` : `${n} sn`;
}

const provinces = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir',
  'Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli',
  'Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkâri',
  'Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir',
  'Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir',
  'Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat',
  'Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman',
  'Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
];
export function regionLabel(country: string | null, region: string | null) {
  if (!country) return 'Konum bilinmiyor';
  const nation = new Intl.DisplayNames(['tr'],{type:'region'}).of(country) || country;
  if (!region) return `${nation} · İl/bölge bilinmiyor`;
  const code = country === 'TR' ? Number(region.replace(/^TR-/,'')) : NaN;
  return `${nation} · ${Number.isInteger(code) && code > 0 && code <= 81 ? provinces[code-1] : region}`;
}