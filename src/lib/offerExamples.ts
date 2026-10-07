// Display-only examples: never use these identifiers in database or offer APIs.
const rows = [
  ['Traktör — 75 HP', 'Tarım makineleri', 'Konya', 875000, '1 adet', 'Bakımlı traktör için örnek teklif ilanı. Fiyat ve özellikler temsilidir.', 'tractor', '#dfe8da'],
  ['Ekmeklik buğday', 'Tarla ürünleri', 'Ankara', 12500, '1 ton', 'Hasat sonrası dökme buğday. Ton bazında görüşmeyi gösteren örnek ilandır.', 'wheat', '#f2e6bd'],
  ['Sera domatesi', 'Sebze', 'Antalya', 24000, '1 ton', 'Taze domates için örnek toplu satış ilanı. Gerçek stok veya satıcı yoktur.', 'tomato', '#eadfd3'],
  ['Sızma zeytinyağı', 'Gıda ürünleri', 'Aydın', 9500, '20 litre', 'Yeni sezon zeytinyağı için örnek ilan. Ürün ve fiyat temsilidir.', 'oil', '#e9e8c9'],
  ['Balya makinesi', 'Tarım makineleri', 'Balıkesir', 285000, '1 adet', 'İkinci el balya makinesi için örnek ilan. Satışa sunulan gerçek bir makine değildir.', 'baler', '#dce4e8'],
  ['Ceviz fidanı', 'Fidan ve tohum', 'Bursa', 18000, '100 adet', 'Toplu fidan alımı için örnek ilan. Gerçek stok veya teslimat taahhüdü yoktur.', 'tree', '#dfead9'],
  ['Yonca balyası', 'Hayvancılık', 'Eskişehir', 16000, '1 ton', 'Yemlik yonca için örnek teklif ilanı. Tüm bilgiler temsilidir.', 'hay', '#eee3c9'],
  ['Patates — çuvallı', 'Sebze', 'Niğde', 14000, '1 ton', 'Çuvallı patates için örnek toplu satış ilanı. Gerçek satıcı veya ürün yoktur.', 'potato', '#e9ddca'],
] as const;

const art: Record<string, string> = {
  tractor: '<circle cx="132" cy="152" r="39" fill="#293b31"/><circle cx="132" cy="152" r="20" fill="#c4ccbb"/><circle cx="261" cy="165" r="26" fill="#293b31"/><circle cx="261" cy="165" r="13" fill="#c4ccbb"/><path d="M112 131V74h80l21 58h65v28h-96l-22-29Z" fill="#53754b"/><path d="M136 84h42l14 41h-56Z" fill="#cce1e1"/><path d="M241 133V97h10v36" fill="#526152"/>',
  wheat: '<path d="M175 186V48M175 100l-35-28M175 121l-35-28M175 141l-35-28M175 99l35-28M175 120l35-28M175 140l35-28" stroke="#b18b32" stroke-width="8" stroke-linecap="round"/><path d="M139 70l-11-25M210 70l11-25" stroke="#b18b32" stroke-width="3"/><ellipse cx="149" cy="87" rx="10" ry="21" transform="rotate(-40 149 87)" fill="#d8b75c"/><ellipse cx="200" cy="87" rx="10" ry="21" transform="rotate(40 200 87)" fill="#d8b75c"/><ellipse cx="149" cy="109" rx="10" ry="21" transform="rotate(-40 149 109)" fill="#d8b75c"/><ellipse cx="200" cy="109" rx="10" ry="21" transform="rotate(40 200 109)" fill="#d8b75c"/>',
  tomato: '<circle cx="139" cy="145" r="39" fill="#ba5342"/><circle cx="218" cy="146" r="42" fill="#cd5e45"/><circle cx="176" cy="102" r="38" fill="#d16a4a"/><path d="M139 104l-19 13 19-5 20 6-12-15M218 103l-20 16 20-6 18 8-11-17M176 63l-19 15 19-6 20 8-13-16" fill="#527947"/>',
  oil: '<path d="M160 68h40v36l13 19v70h-66v-70l13-19Z" fill="#84933f"/><rect x="160" y="58" width="40" height="13" rx="3" fill="#aa9251"/><rect x="151" y="129" width="58" height="39" rx="4" fill="#f5edce"/><path d="M180 157v-20M180 147l-9-6M180 150l9-7" stroke="#657741" stroke-width="3"/><ellipse cx="242" cy="181" rx="17" ry="10" fill="#77864a"/><ellipse cx="120" cy="179" rx="16" ry="10" fill="#4d653d"/>',
  baler: '<rect x="110" y="93" width="155" height="75" rx="12" fill="#aa5840"/><path d="M110 114h-25v50h25M265 128h26v9h-26" fill="#7e4235"/><rect x="135" y="106" width="80" height="40" rx="5" fill="#ce8c65"/><circle cx="141" cy="172" r="24" fill="#344036"/><circle cx="141" cy="172" r="12" fill="#c5c7b7"/><circle cx="239" cy="172" r="24" fill="#344036"/><circle cx="239" cy="172" r="12" fill="#c5c7b7"/>',
  tree: '<path d="M169 183V91M169 133l-29-25M169 118l30-28" stroke="#8b704c" stroke-width="8" stroke-linecap="round"/><ellipse cx="138" cy="96" rx="32" ry="22" fill="#759763"/><ellipse cx="196" cy="83" rx="34" ry="25" fill="#618b51"/><ellipse cx="161" cy="65" rx="35" ry="25" fill="#8ba870"/><path d="M138 178h63l-10 28h-43Z" fill="#a87c54"/>',
  hay: '<rect x="105" y="127" width="70" height="57" rx="9" fill="#ba9c57"/><rect x="180" y="127" width="70" height="57" rx="9" fill="#d1b56b"/><rect x="143" y="67" width="70" height="57" rx="9" fill="#c7ad62"/><path d="M122 128v56M158 128v56M196 128v56M233 128v56M161 68v55M196 68v55" stroke="#917c45" stroke-width="4"/>',
  potato: '<path d="M120 93h121l-9 99H130Z" fill="#b39569"/><path d="M135 100h88M141 114h76M136 132h85M139 150h78M137 171h84" stroke="#d1b58a" stroke-width="4"/><ellipse cx="156" cy="84" rx="28" ry="19" fill="#bd965b"/><ellipse cx="203" cy="78" rx="27" ry="23" fill="#cda770"/><ellipse cx="237" cy="184" rx="30" ry="21" fill="#c6a06a"/><circle cx="227" cy="181" r="2" fill="#8c6a43"/><circle cx="247" cy="192" r="2" fill="#8c6a43"/>',
};

export const offerExamples = rows.map(([title, category, location, price, quantity, description, kind, background], index) => ({
  id: `demo-offer-${index + 1}`,
  title: `Örnek ilan · ${title}`,
  category, location, price, quantity, description,
  image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240"><rect width="360" height="240" fill="${background}"/><ellipse cx="180" cy="203" rx="104" ry="9" fill="#243c2c" opacity=".08"/>${art[kind]}</svg>`)}`,
}));
