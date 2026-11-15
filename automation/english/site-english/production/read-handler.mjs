import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {sourceHash,PUBLIC_ORIGIN,hasCurrentTranslation} from '../public-source.mjs';
import {pageForUrl,esc} from '../pages.mjs';
import {liveEnglishDocument,englishSitemap} from './documents.mjs';
import {limitedBytes,MAX_CATALOG_BYTES} from './catalog-contract.mjs';

const runtimeFile=fileURLToPath(new URL('../browser-runtime.mjs',import.meta.url));
const PUBLIC_ROUTES=new Set(['public-listings','site-settings','offers','gazette','gazette-comments',
  'gazette-banners','gazette-advertisements','advertisements','gazette-promotions','gazette-breaking-news','gazette-weather','market-prices']);
const PUBLIC_QUERY=new Set(['id','article_id','slug','category','limit','offset','cursor','page','q','search','province','district','product','type','resource']);
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');

export function createEnglishReadHandler({store,templates,request=fetch,indexable=false,now=Date.now}){
  const cache=new Map();
  async function publicRead(route,query=new URLSearchParams()){
    if(!PUBLIC_ROUTES.has(route))throw new Error('NOT_A_PUBLIC_ENGLISH_RESOURCE');
    const url=new URL('/api/'+route,PUBLIC_ORIGIN);
    for(const [key,value]of query)if(PUBLIC_QUERY.has(key)&&value.length<=256)url.searchParams.append(key,value);
    const key=url.href,saved=cache.get(key);
    if(saved&&saved.expires>now())return saved.body;
    const response=await request(url.href,{redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('ENGLISH_PUBLIC_READ_UNAVAILABLE');
    const body=JSON.parse((await limitedBytes(response,MAX_CATALOG_BYTES)).toString('utf8'));
    cache.set(key,{body,expires:now()+60000});
    if(cache.size>100)cache.delete(cache.keys().next().value);
    return body;
  }
  return async(req,res)=>{
    const send=(status,type,body,noindex=false)=>{
      res.statusCode=status;res.setHeader('Content-Type',type+'; charset=utf-8');
      res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
      if(!indexable||noindex)res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
      res.end(req.method==='HEAD'?undefined:body);
    };
    if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(405,'application/json',json({error:'READ_ONLY_RESOURCE'}),true);}
    const url=new URL(req.url,PUBLIC_ORIGIN);
    try{
      if(url.pathname==='/_english/runtime.js')
        return send(200,'text/javascript',await readFile(runtimeFile,'utf8'),true);
      const catalog=await store.read();
      const version=sourceHash(catalog.dictionary);
      if(url.pathname==='/_english/current.json')return send(200,'application/json',json(catalog),true);
      if(url.pathname===`/_english/catalog/${version}.js`)
        return send(200,'text/javascript',`export default ${json(catalog.dictionary)};`,true);
      if(url.pathname.startsWith('/_english/catalog/'))return send(404,'application/json',json({error:'ENGLISH_EDITION_CHANGED'}),true);
      if(url.pathname==='/en/sitemap.xml')return send(200,'application/xml',englishSitemap(catalog));
      if(url.pathname.startsWith('/_english/public-api/')){
        const route=url.pathname.slice('/_english/public-api/'.length);
        if(!PUBLIC_ROUTES.has(route))return send(403,'application/json',json({error:'PUBLIC_READ_ONLY'}),true);
        let body=await publicRead(route,url.searchParams);
        if(route==='public-listings'&&Array.isArray(body.listings))
          body={...body,listings:body.listings.filter(row=>hasCurrentTranslation('listing',row,catalog))};
        if(route==='gazette')body={...body,articles:(body.articles||[]).filter(row=>hasCurrentTranslation('article',row,catalog)),canManage:false};
        if(route==='offers')body={...body,offers:(body.offers||[]).filter(row=>hasCurrentTranslation('offer',row,catalog)),messages:[],owner_ids:[]};
        if(route==='site-settings')body={...body,settings:{...body.settings,...catalog.source.settings}};
        res.setHeader('X-PT-English-Catalog',version);
        res.setHeader('X-PT-English-Checked-At',catalog.lastCheckedAt||catalog.source.checkedAt);
        return send(200,'application/json',json(body),true);
      }
      const page=pageForUrl(url,catalog);
      if(!page)return send(404,'text/html','<!doctype html><html lang="en"><title>Not found | PazarTarla</title><h1>Page not found</h1><a href="/en/">Marketplace</a></html>',true);
      if(page.record){
        const article=page.kind==='article',key=article?'articles':'listings';
        const body=await publicRead(article?'gazette':'public-listings');
        const current=body[key]?.find(row=>String(row.id)===String(page.record.id));
        if(!current)return send(404,'text/html','<!doctype html><html lang="en"><title>Unavailable | PazarTarla</title><h1>This publication is no longer available.</h1></html>',true);
        if(!hasCurrentTranslation(article?'article':'listing',current,catalog)){
          res.setHeader('Retry-After','1800');
          return send(503,'text/html',`<!doctype html><html lang="en"><title>English update pending | PazarTarla</title><h1>The English update is being prepared.</h1><a href="${esc(PUBLIC_ORIGIN+page.sourcePath)}">Current Turkish original</a></html>`,true);
        }
      }
      if(url.pathname!==page.path){res.setHeader('Location',page.path+url.search);return send(308,'text/plain','');}
      return send(200,'text/html',liveEnglishDocument(templates[page.entry==='gazette'?'gazette':'marketplace'],page,catalog,{indexable}));
    }catch{
      // A storage/provider error is not a successful English page or a Turkish
      // homepage. The original site remains available through its unchanged route.
      res.setHeader('Retry-After','300');
      return send(503,'application/json',json({error:'ENGLISH_EDITION_UNAVAILABLE'}),true);
    }
  };
}

// Protected previews must not depend on a separate writable database credential.
// Production keeps the original listing handler. This adapter reads only the
// same anonymous public records a visitor can see, without forwarding headers.
export function createPreviewPublicListingsHandler({request=fetch}={}){
  return async(req,res)=>{
    const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
    if(req.method!=='GET')return send(405,{error:'method_not_allowed'});
    const resource=req.query?.resource;
    if(resource&&!['listings','advertisements'].includes(resource))return send(404,{error:'resource_not_found'});
    try{
      const url=PUBLIC_ORIGIN+'/api/public-listings'+(resource==='advertisements'?'?resource=advertisements':'');
      const response=await request(url,{method:'GET',headers:{accept:'application/json'},
        redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!response.ok)return send(503,{error:'public_preview_source_unavailable'});
      const body=JSON.parse((await limitedBytes(response,MAX_CATALOG_BYTES)).toString('utf8'));
      const key=resource==='advertisements'?'advertisements':'listings';
      if(!Array.isArray(body[key]))throw new Error('Invalid public source');
      return send(200,{[key]:body[key]});
    }catch{return send(503,{error:'public_preview_source_unavailable'});}
  };
}
