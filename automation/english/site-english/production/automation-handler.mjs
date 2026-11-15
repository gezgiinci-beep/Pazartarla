import {gunzipSync} from 'node:zlib';
import {timingSafeEqual} from 'node:crypto';
import {validateCatalog,MAX_UPLOAD_BYTES,MAX_CATALOG_BYTES} from './catalog-contract.mjs';
import {sourceRevision,fetchPublicSources} from '../public-source.mjs';

async function readUpload(req){
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/gzip')
    throw Object.assign(new Error('UNSUPPORTED_ENGLISH_UPLOAD'),{status:415});
  if(Number(req.headers?.['content-length'])>MAX_UPLOAD_BYTES)
    throw Object.assign(new Error('ENGLISH_UPLOAD_TOO_LARGE'),{status:413});
  const chunks=[];let size=0;
  const parts=Buffer.isBuffer(req.body)?[req.body]:req;
  for await(const chunk of parts){
    const value=Buffer.from(chunk);size+=value.length;
    if(size>MAX_UPLOAD_BYTES)throw Object.assign(new Error('ENGLISH_UPLOAD_TOO_LARGE'),{status:413});
    chunks.push(value);
  }
  return JSON.parse(gunzipSync(Buffer.concat(chunks,size),{maxOutputLength:MAX_CATALOG_BYTES}).toString('utf8'));
}

export function createEnglishSyncHandler({authenticate,store,readSources=fetchPublicSources,enabled=false}){
  return async(req,res)=>{
    const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'METHOD_NOT_ALLOWED'});}
    if(!enabled)return send(503,{error:'ENGLISH_SYNC_NOT_ENABLED'});
    if(!await authenticate(req))return send(401,{error:'UNAUTHORIZED'});
    try{
      const catalog=await readUpload(req);
      validateCatalog(catalog,{fresh:true});
      const live=await readSources();
      const expected=Buffer.from(sourceRevision(live)),actual=Buffer.from(catalog.sourceRevision);
      // A deleted, unapproved, or edited public record must not be republished
      // from a stale worker cache. The next scheduled run retries a changed source.
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))
        return send(409,{error:'PUBLIC_SOURCE_CHANGED'});
      return send(200,{ok:true,...await store.publish(catalog)});
    }catch(error){
      return send(error.status||422,{error:error.status?error.message:'ENGLISH_SYNC_REJECTED'});
    }
  };
}
