import {createHash} from 'node:crypto';

export const PUBLIC_ORIGIN='https://www.pazartarla.com.tr';
export const sourceHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const publicFields=['id','title','price','category','subCategory','mode','location','description','image','gallery_paths','is_featured','status','created_at','expires_at'];
export function cleanListing(row){
  if(row.status!=='approved')return null;
  return Object.fromEntries(publicFields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
}
export function cleanArticle(row){
  if(row.status!=='published')return null;
  return Object.fromEntries(['id','title','slug','category','excerpt','body','author_comment','media','revision','created_at','updated_at','published_at','status'].map(key=>[key,row[key]]));
}
export async function fetchPublicSources(fetcher=fetch){
  async function read(path,key){
    const response=await fetcher(PUBLIC_ORIGIN+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000),redirect:'error'});
    if(!response.ok)throw new Error(`Public source unavailable: ${path}, status ${response.status}`);
    const body=await response.json();
    if(!Array.isArray(body[key]))throw new Error(`Invalid public ${key} response`);
    return body[key];
  }
  const [listings,articles,settingsResponse,offers]=await Promise.all([
    read('/api/public-listings','listings'),read('/api/gazette','articles'),
    fetcher(PUBLIC_ORIGIN+'/api/site-settings',{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000),redirect:'error'}),
    read('/api/offers','offers'),
  ]);
  if(!settingsResponse.ok)throw new Error('Public settings unavailable');
  const settingsBody=await settingsResponse.json(),row=settingsBody.settings;
  if(!row||typeof row!=='object')throw new Error('Invalid public settings response');
  const settings=Object.fromEntries(['announcement','categories','featured_offer'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
  return {checkedAt:new Date().toISOString(),listings:listings.map(cleanListing).filter(Boolean),articles:articles.map(cleanArticle).filter(Boolean),settings,
    offers:offers.map(row=>Object.fromEntries(['id','title','description','product_name'].filter(key=>typeof row[key]==='string'||key==='id').map(key=>[key,row[key]])))};
}
export function publicTranslationTexts(source){
  const texts=[];
  for(const row of source.listings)for(const key of ['title','description','category','subCategory','mode'])if(typeof row[key]==='string')texts.push(row[key]);
  for(const row of source.articles){
    for(const key of ['title','excerpt','body','author_comment'])if(typeof row[key]==='string')texts.push(row[key]);
    for(const media of row.media||[])if(media.alt)texts.push(media.alt);
  }
  const collect=value=>{
    if(typeof value==='string'){if(value.trim()&&!/^https?:\/\//.test(value))texts.push(value);return;}
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      if(/^(?:id|value|slug|key|icon|url|image|phone|email|price|amount|currency)$/i.test(key))continue;
      if(!Array.isArray(value)&&/\p{L}/u.test(key))texts.push(key);
      collect(child);
    }
  };
  collect(source.settings);
  for(const row of source.offers||[])for(const key of ['title','description','product_name'])if(row[key])texts.push(row[key]);
  return [...new Set(texts.filter(text=>text.trim()))];
}
export function sourceRevision(source){return sourceHash({listings:source.listings,articles:source.articles,settings:source.settings,offers:source.offers});}
export function publicRecordRevision(kind,row){
  const fields=kind==='listing'
    ?['id','title','description','category','subCategory','mode','price','location','status','expires_at']
    :kind==='article'
      ?['id','title','excerpt','body','author_comment','category','status','revision','published_at','updated_at']
      :['id','title','description','product_name'];
  return sourceHash(Object.fromEntries(fields.map(key=>[key,row[key]??null])));
}
export function hasCurrentTranslation(kind,row,catalog){
  const group=kind==='listing'?'listings':kind==='article'?'articles':'offers';
  const saved=catalog.source[group]?.find(record=>String(record.id)===String(row.id));
  return Boolean(saved&&publicRecordRevision(kind,saved)===publicRecordRevision(kind,row));
}
