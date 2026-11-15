import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {sourceHash,sourceRevision,fetchPublicSources,publicTranslationTexts} from '../public-source.mjs';
import {validateCatalog,MAX_UPLOAD_BYTES,OIDC_PROFILE,limitedBytes,MAX_CATALOG_BYTES} from './catalog-contract.mjs';

const WORKER_ROOT=new URL('../../../../',import.meta.url);
export async function runEnglishWorker({
  request=fetch,readSources=fetchPublicSources,prepare,readPrevious,
  acquireToken,dryRun=false,verifyConnection=false,onProgress=console.log,
}){
  const source=await readSources(),previous=await readPrevious();
  validateCatalog(previous);
  const unchanged=sourceHash({...source,checkedAt:null})===sourceHash({...previous.source,checkedAt:null});
  if(unchanged&&!verifyConnection)
    return {changed:false,reason:'PUBLIC_SOURCE_UNCHANGED'};
  // A manual connection check transfers genuine current public data even when
  // no text changed. It never invents records or downloads an unnecessary model.
  const catalog=unchanged?{...previous,source,sourceRevision:sourceRevision(source)}:
    await prepare({previous,source});
  validateCatalog(catalog,{fresh:true});
  const payload=gzipSync(Buffer.from(JSON.stringify(catalog)));
  if(payload.length>MAX_UPLOAD_BYTES)throw new Error('ENGLISH_CATALOG_NEEDS_PARTITIONING');
  if(dryRun)return {changed:!unchanged,dryRun:true,bytes:payload.length};
  const token=await acquireToken();
  const response=await request(OIDC_PROFILE.audience,{
    method:'POST',headers:{'content-type':'application/gzip',authorization:`Bearer ${token}`},
    redirect:'error',signal:AbortSignal.timeout(60000),body:payload,
  });
  if(!response.ok)throw new Error(`ENGLISH_PUBLISH_FAILED_${response.status}`);
  const result=await response.json();
  if(result.ok!==true)throw new Error('ENGLISH_PUBLISH_NOT_CONFIRMED');
  onProgress(unchanged?'English public edition connection verified; public content was unchanged.':
    `English public edition updated: ${catalog.source.listings.length} listings, ${catalog.source.articles.length} articles.`);
  return {changed:!unchanged,verified:true,version:result.version};
}

async function githubOidcToken(){
  // GitHub supplies short-lived runner credentials. Never print or persist them.
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.actions.githubusercontent.com'))
    throw new Error('NOT_A_GITHUB_OIDC_RUNNER');
  url.searchParams.set('audience',OIDC_PROFILE.audience);
  const response=await fetch(url,{headers:{authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},
    redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('GITHUB_OIDC_UNAVAILABLE');
  const result=await response.json();
  if(typeof result.value!=='string')throw new Error('GITHUB_OIDC_UNAVAILABLE');
  return result.value;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const dryRun=process.argv.includes('--dry-run');
  const verifyConnection=process.argv.includes('--verify-connection');
  const directory=new URL('generated-artifacts/site-english/',WORKER_ROOT);
  await mkdir(directory,{recursive:true});
  const readPrevious=async()=>{
    // The production server exposes only the sanitized public catalogue, never
    // member records. Its exact current revision seeds incremental translation.
    const response=await fetch('https://www.pazartarla.com.tr/_english/current.json',{
      redirect:'error',signal:AbortSignal.timeout(30000),headers:{accept:'application/json'},
    });
    if(!response.ok)throw new Error(`ENGLISH_LIVE_CATALOG_NOT_READY_${response.status}`);
    return JSON.parse((await limitedBytes(response,MAX_CATALOG_BYTES)).toString('utf8'));
  };
  const prepare=async({previous,source})=>{
    // Lazy import avoids loading ONNX when public sources did not change.
    const {buildTranslationCatalog}=await import('../prepare.mjs');
    const oldContent=new Set(publicTranslationTexts(previous.source));
    const uiKeys=previous.uiKeys?new Set(previous.uiKeys):null;
    const reviewed=Object.fromEntries(Object.entries(previous.dictionary).filter(([key])=>
      uiKeys?uiKeys.has(key):!oldContent.has(key)));
    const catalog=await buildTranslationCatalog({
      previous,source,ui:true,uiTexts:Object.keys(reviewed),reviewed,
    });
    await writeFile(new URL('worker-catalog.json',directory),JSON.stringify(catalog));
    return catalog;
  };
  // No source settings or model weights are pushed into Git history.
  console.log(await runEnglishWorker({prepare,readPrevious,acquireToken:githubOidcToken,dryRun,verifyConnection}));
}
