// Location choices are derived from real listing locations; no browser geolocation is used.
const GENERIC = /türkiye geneli|konum belirtilmemiş/i;
export const PROVINCES = 'Adana Adıyaman Afyonkarahisar Ağrı Aksaray Amasya Ankara Antalya Ardahan Artvin Aydın Balıkesir Bartın Batman Bayburt Bilecik Bingöl Bitlis Bolu Burdur Bursa Çanakkale Çankırı Çorum Denizli Diyarbakır Düzce Edirne Elazığ Erzincan Erzurum Eskişehir Gaziantep Giresun Gümüşhane Hakkari Hatay Iğdır Isparta İstanbul İzmir Kahramanmaraş Karabük Karaman Kars Kastamonu Kayseri Kırıkkale Kırklareli Kırşehir Kilis Kocaeli Konya Kütahya Malatya Manisa Mardin Mersin Muğla Muş Nevşehir Niğde Ordu Osmaniye Rize Sakarya Samsun Siirt Sinop Sivas Şanlıurfa Şırnak Tekirdağ Tokat Trabzon Tunceli Uşak Van Yalova Yozgat Zonguldak'.split(' ').sort((a, b) => a.localeCompare(b, 'tr'));
const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

export function parseLocation(location: unknown): { district: string; province: string } | null {
  if (typeof location !== 'string' || !location.trim() || GENERIC.test(location)) return null;
  const tokens = location.split(/[\s/,-]+/).filter(Boolean);
  if (!tokens.length) return null;
  const provinceMap = new Map(PROVINCES.map(province => [key(province), province]));
  const last = provinceMap.get(key(tokens[tokens.length - 1]));
  if (last) return { province: last, district: tokens.slice(0, -1).join(' ') };
  const lastPair = tokens.length >= 2 ? provinceMap.get(key(tokens.slice(-2).join(''))) : undefined;
  if (lastPair) return { province: lastPair, district: tokens.slice(0, -2).join(' ') };
  const first = provinceMap.get(key(tokens[0]));
  if (first) return { province: first, district: tokens.slice(1).join(' ') };
  const firstPair = tokens.length >= 2 ? provinceMap.get(key(tokens.slice(0, 2).join(''))) : undefined;
  if (firstPair) return { province: firstPair, district: tokens.slice(2).join(' ') };
  return { province: '', district: location.trim() };
}

export function locationOptions(listings: any[], province: string) {
  const provinces = new Set<string>();
  const districts = new Map<string, string>();
  for (const listing of listings) {
    const parsed = parseLocation(listing.location);
    if (!parsed) continue;
    if (parsed.province) provinces.add(parsed.province);
    if (province && key(parsed.province) === key(province) && parsed.district && !districts.has(key(parsed.district))) {
      districts.set(key(parsed.district), parsed.district);
    }
  }
  const sort = (values: Iterable<string>) => [...values].sort((a, b) => a.localeCompare(b, 'tr'));
  return { provinces: sort(provinces), districts: sort(districts.values()) };
}

export function matchesLocation(location: unknown, province: string, district: string) {
  if (!province && !district) return true;
  const parsed = parseLocation(location);
  if (!parsed) return false;
  return (!province || key(parsed.province) === key(province)) && (!district || key(parsed.district) === key(district));
}

export function matchesSearch(item: any, query: string) {
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  if (!needle) return true;
  const id = needle.replace(/^#/, '');
  if (/^\d+$/.test(id)) return Number.isSafeInteger(Number(id)) && Number(item.id) === Number(id);
  return [item.title, item.description, item.category, item.subCategory, item.location, item.seoTags]
    .some(value => typeof value === 'string' && value.toLocaleLowerCase('tr-TR').includes(needle));
}

export type SortKey = 'default' | 'newest' | 'priceAsc' | 'priceDesc';

export function sortListings<T extends { price?: unknown; created_at?: unknown }>(rows: T[], sort: SortKey): T[] {
  if (sort === 'default') return rows;
  const price = (row: T) => {
    if (row.price === null || row.price === undefined || String(row.price).trim() === '') return null;
    const amount = Number(row.price);
    return Number.isFinite(amount) ? amount : null;
  };
  const time = (row: T) => {
    const timestamp = Date.parse(String(row.created_at ?? ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  return [...rows].sort((a, b) => {
    if (sort === 'newest') return time(b) - time(a);
    const priceA = price(a), priceB = price(b);
    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return sort === 'priceAsc' ? priceA - priceB : priceB - priceA;
  });
}
