import {sourceHash} from '../public-source.mjs';
import {validateCatalog,safeBlobUrl,limitedBytes,MAX_CATALOG_BYTES,POINTER_PATH} from './catalog-contract.mjs';

// The inference model and its dependencies never enter the website function.
// The existing Blob SDK keeps its token server-side; callers never supply URLs.
export function createCatalogStore({list,put,remove,request=fetch,seed,now=Date.now,ttl=60000}){
  let cached=null,expires=0,pending;
  async function readJson(url,limit){
    if(!safeBlobUrl(url))throw new Error('UNSAFE_ENGLISH_STORAGE_URL');
    const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
    if(!response.ok)throw new Error('ENGLISH_STORAGE_UNAVAILABLE');
    return JSON.parse((await limitedBytes(response,limit)).toString('utf8'));
  }
  async function load(){
    const result=await list({prefix:POINTER_PATH,limit:2});
    const pointer=result.blobs?.find(blob=>blob.pathname===POINTER_PATH);
    if(!pointer){
      if(!seed)throw new Error('ENGLISH_STORAGE_NOT_INITIALIZED');
      validateCatalog(seed,{now:now()});return seed;
    }
    const current=await readJson(pointer.url,4096);
    if(!current||!safeBlobUrl(current.url)||!/^[a-f0-9]{64}$/.test(current.digest||'')
      ||new URL(current.url).origin!==new URL(pointer.url).origin
      ||new URL(current.url).pathname!==`/english/catalog-${current.digest}.json`)
      throw new Error('INVALID_ENGLISH_POINTER');
    if(cached&&sourceHash(cached)===current.digest)return cached;
    const catalog=await readJson(current.url,MAX_CATALOG_BYTES);
    validateCatalog(catalog,{now:now()});
    if(sourceHash(catalog)!==current.digest)throw new Error('ENGLISH_CATALOG_INTEGRITY_FAILED');
    return catalog;
  }
  return {
    async read({force=false}={}){
      if(cached&&!force&&expires>now())return cached;
      if(!pending)pending=load().then(value=>{cached=value;expires=now()+ttl;return value;})
        .finally(()=>{pending=null;});
      // Do not silently roll back to a bundled old catalogue after a storage failure.
      return pending;
    },
    async publish(catalog){
      const summary=validateCatalog(catalog,{now:now(),fresh:true});
      const current=await this.read({force:true});
      if(current.sourceRevision===catalog.sourceRevision
        &&sourceHash(current.dictionary)===summary.version)return {changed:false,...summary};
      if(Date.parse(current.source.checkedAt)>Date.parse(catalog.source.checkedAt))
        throw new Error('OLDER_ENGLISH_CATALOG');
      const digest=sourceHash(catalog),pathname=`english/catalog-${digest}.json`;
      // Immutable content first; mutable pointer last. A failed upload never
      // replaces the last complete edition. Workflow concurrency serializes writes.
      const uploaded=await put(pathname,JSON.stringify(catalog),{
        access:'public',addRandomSuffix:false,allowOverwrite:true,
        contentType:'application/json; charset=utf-8',cacheControlMaxAge:31536000,
      });
      if(!safeBlobUrl(uploaded.url)||new URL(uploaded.url).pathname!==`/${pathname}`)
        throw new Error('INVALID_ENGLISH_UPLOAD_URL');
      await put(POINTER_PATH,JSON.stringify({digest,url:uploaded.url,checkedAt:catalog.source.checkedAt}),{
        access:'public',addRandomSuffix:false,allowOverwrite:true,
        contentType:'application/json; charset=utf-8',cacheControlMaxAge:60,
      });
      cached=catalog;expires=now()+ttl;
      let cleanupPending=false;
      if(remove){
        try{
          const protectedDigests=new Set([digest,sourceHash(current)]);
          const old=await list({prefix:'english/catalog-',limit:1000});
          const obsolete=(old.blobs||[]).filter(blob=>{
            const match=String(blob.pathname).match(/^english\/catalog-([a-f0-9]{64})\.json$/);
            return match&&!protectedDigests.has(match[1])&&safeBlobUrl(blob.url)
              &&new URL(blob.url).origin===new URL(uploaded.url).origin
              &&Date.parse(blob.uploadedAt)<now()-2*60*60*1000;
          }).slice(0,50);
          if(obsolete.length)await remove(obsolete.map(blob=>blob.url));
        }catch{cleanupPending=true;}
      }
      return {changed:true,cleanupPending,...summary};
    },
  };
}
