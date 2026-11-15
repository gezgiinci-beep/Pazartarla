import {sourceHash,sourceRevision,cleanArticle,cleanListing,publicTranslationTexts} from '../public-source.mjs';

export const MAX_CATALOG_BYTES=8*1024*1024;
export const MAX_UPLOAD_BYTES=1800*1024;
export const POINTER_PATH='english/current.json';
export const OIDC_PROFILE=Object.freeze({
  audience:'https://www.pazartarla.com.tr/api/english-sync',
  workflow:'translate-english.yml',
});

// Validate both the worker output and stored files, not just an HTTP status.
// No account, message, phone or authorization fields may be added to records.
export function validateCatalog(catalog,{now=Date.now(),fresh=false}={}){
  const fail=()=>{throw new Error('INVALID_ENGLISH_CATALOG');};
  if(!catalog||catalog.version!==2||catalog.machineTranslated!==true
    ||catalog.coverage?.complete!==true||catalog.coverage?.uiIncluded!==true
    ||!catalog.dictionary||Array.isArray(catalog.dictionary))fail();
  const source=catalog.source;
  if(!source||!Array.isArray(source.listings)||!Array.isArray(source.articles)
    ||!Array.isArray(source.offers)||!source.settings||typeof source.settings!=='object')fail();
  for(const key of Object.keys(source))if(!['checkedAt','listings','articles','offers','settings'].includes(key))fail();
  if(!Number.isFinite(Date.parse(source.checkedAt))
    ||Date.parse(source.checkedAt)>now+60000
    ||(fresh&&Date.parse(source.checkedAt)<now-2*60*60*1000))fail();
  if(source.listings.some(row=>!cleanListing(row)||sourceHash(cleanListing(row))!==sourceHash(row)))fail();
  if(source.articles.some(row=>!cleanArticle(row)||sourceHash(cleanArticle(row))!==sourceHash(row)))fail();
  for(const row of source.offers){
    if(!row||Object.keys(row).some(key=>!['id','title','description','product_name'].includes(key)))fail();
  }
  if(Object.keys(source.settings).some(key=>!['announcement','categories','featured_offer'].includes(key)))fail();
  for(const [key,value]of Object.entries(catalog.dictionary)){
    if(['__proto__','prototype','constructor'].includes(key)||!key.trim()
      ||typeof value!=='string'||!value.trim())fail();
  }
  if(publicTranslationTexts(source).some(text=>!Object.hasOwn(catalog.dictionary,text)))fail();
  if(sourceRevision(source)!==catalog.sourceRevision)fail();
  const bytes=Buffer.byteLength(JSON.stringify(catalog));
  if(bytes>MAX_CATALOG_BYTES)fail();
  return {bytes,version:sourceHash(catalog.dictionary),sourceRevision:catalog.sourceRevision,
    preparedAt:catalog.preparedAt,checkedAt:source.checkedAt};
}

export function safeBlobUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash
      &&/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
      &&/^\/english\/(?:current\.json|catalog-[a-f0-9]{64}\.json)$/.test(url.pathname);
  }catch{return false;}
}

export async function limitedBytes(response,limit){
  if(Number(response.headers?.get('content-length'))>limit)throw new Error('ENGLISH_RESPONSE_TOO_LARGE');
  if(!response.body?.getReader){
    const result=Buffer.from(await response.arrayBuffer());
    if(result.length>limit)throw new Error('ENGLISH_RESPONSE_TOO_LARGE');
    return result;
  }
  const reader=response.body.getReader(),chunks=[];
  let length=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      length+=value.length;
      if(length>limit){await reader.cancel();throw new Error('ENGLISH_RESPONSE_TOO_LARGE');}
      chunks.push(Buffer.from(value));
    }
  }finally{reader.releaseLock();}
  return Buffer.concat(chunks,length);
}
