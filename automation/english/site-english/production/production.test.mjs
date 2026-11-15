import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createCatalogStore} from './catalog-store.mjs';
import {createEnglishSyncHandler} from './automation-handler.mjs';
import {runEnglishWorker} from './worker.mjs';
import {createEnglishReadHandler,createPreviewPublicListingsHandler} from './read-handler.mjs';
import {englishDeploymentRoutes} from './deployment-routes.mjs';
import {validateCatalog,safeBlobUrl,POINTER_PATH} from './catalog-contract.mjs';
import {sourceHash,sourceRevision,cleanListing,cleanArticle} from '../public-source.mjs';
import {liveEnglishDocument,englishSitemap} from './documents.mjs';
import {pageForUrl} from '../pages.mjs';

const origin='https://unit.public.blob.vercel-storage.com';
const template='<!doctype html><html lang="tr"><head><title>Eski</title><meta name="robots" content="noindex"><script type="module" src="/assets/english-test.js"></script></head><body><div id="root"></div></body></html>';
function fixture(){
  const checkedAt=new Date().toISOString();
  const source={checkedAt,listings:[cleanListing({id:1,title:'Ceviz',description:'Taze ceviz',category:'Ürün',status:'approved',price:100})],
    articles:[cleanArticle({id:2,title:'Hasat',excerpt:'Haber özeti',body:'Yeni hasat başladı',slug:'hasat',
      category:'haber',status:'published',revision:1,published_at:checkedAt,updated_at:checkedAt})],
    offers:[],settings:{categories:[],announcement:''}};
  return {version:2,machineTranslated:true,source,sourceRevision:sourceRevision(source),preparedAt:checkedAt,
    dictionary:{Ceviz:'Walnut','Taze ceviz':'Fresh walnut',Ürün:'Product',Hasat:'Harvest',
      'Haber özeti':'News summary','Yeni hasat başladı':'The new harvest has begun',
      categories:'categories',announcement:'announcement'},
    coverage:{complete:true,uiIncluded:true,total:6,translated:6}};
}
function response(){
  return {headers:{},setHeader(key,value){this.headers[key]=value;},end(body){this.body=body;}};
}
function memoryStore(seed=fixture()){
  const files=new Map(),writes=[];
  const store=createCatalogStore({seed,
    list:async()=>({blobs:[...files.keys()].filter(path=>path===POINTER_PATH).map(path=>({pathname:path,url:`${origin}/${path}`}))}),
    put:async(path,body)=>{writes.push(path);files.set(path,body);return {url:`${origin}/${path}`};},
    request:async url=>new Response(files.get(new URL(url).pathname.slice(1)),{status:200}),
  });
  return {store,files,writes};
}
test('the public catalogue contract validates the actual public shapes',()=>{
  assert.equal(validateCatalog(fixture()).bytes>0,true);
  const invalid=fixture();invalid.source.listings[0].phone='private';
  assert.throws(()=>validateCatalog(invalid),/INVALID/);
  const incomplete=fixture();delete incomplete.dictionary.Ceviz;
  assert.throws(()=>validateCatalog(incomplete),/INVALID/);
});
test('unapproved records, untrusted settings, corrupt revisions and future dates are refused',()=>{
  for(const mutate of [
    c=>{c.source.listings[0].status='pending';},
    c=>{c.source.settings.auth_token='never';},
    c=>{c.sourceRevision='invalid';},
    c=>{c.source.checkedAt='2099-01-01T00:00:00Z';},
    c=>{c.dictionary.Ceviz='';},
  ]){
    const c=fixture();mutate(c);assert.throws(()=>validateCatalog(c));
  }
});
test('storage URLs cannot select a private host, redirect, query or foreign path',()=>{
  assert.equal(safeBlobUrl(`${origin}/english/current.json`),true);
  for(const url of ['https://localhost/english/current.json',`${origin}/other.json`,
    `${origin}/english/current.json?token=x`,`http://unit.public.blob.vercel-storage.com/english/current.json`,
    `https://unit.public.blob.vercel-storage.com.evil.invalid/english/current.json`])
    assert.equal(safeBlobUrl(url),false);
});
test('an immutable edition is written before its current pointer',async()=>{
  const {store,writes}=memoryStore();
  const next=fixture();next.dictionary.Ceviz='Walnuts';
  const result=await store.publish(next);
  assert.equal(result.changed,true);
  assert.match(writes[0],/^english\/catalog-[a-f0-9]{64}\.json$/);
  assert.equal(writes[1],POINTER_PATH);
  assert.equal((await store.read({force:true})).dictionary.Ceviz,'Walnuts');
});
test('a pointer failure never reports a successful publication',async()=>{
  const first=fixture(),next=fixture();next.dictionary.Ceviz='Walnuts';
  const store=createCatalogStore({seed:first,list:async()=>({blobs:[]}),
    put:async path=>{if(path===POINTER_PATH)throw new Error('offline');return {url:`${origin}/${path}`};}});
  await assert.rejects(()=>store.publish(next),/offline/);
});
test('a damaged stored edition never silently reverts to the bundled seed',async()=>{
  const c=fixture(),digest='a'.repeat(64);
  const store=createCatalogStore({seed:c,list:async()=>({blobs:[{pathname:POINTER_PATH,url:`${origin}/${POINTER_PATH}`}]}),
    request:async url=>new Response(JSON.stringify(url.endsWith('current.json')
      ?{digest,url:`${origin}/english/catalog-${digest}.json`}:c)),put:async()=>{}});
  await assert.rejects(()=>store.read(),/INTEGRITY_FAILED/);
});
test('identical dictionary and public revision create no additional stored files',async()=>{
  const c=fixture(),{store,writes}=memoryStore(c);
  const next=structuredClone(c);next.source.checkedAt=new Date(Date.now()+1).toISOString();
  assert.equal((await store.publish(next)).changed,false);
  assert.equal(writes.length,0);
});
test('retention deletes only old generated editions, never images, current or previous content',async()=>{
  const c=fixture(),next=structuredClone(c);next.dictionary.Ceviz='Walnuts';
  const oldDigest='b'.repeat(64),deleted=[];
  const blob=(pathname,uploadedAt='2020-01-01T00:00:00Z')=>({pathname,uploadedAt,url:`${origin}/${pathname}`});
  const store=createCatalogStore({seed:c,
    list:async({prefix})=>({blobs:prefix===POINTER_PATH?[]:[
      blob(`english/catalog-${oldDigest}.json`),
      blob(`english/catalog-${sourceHash(c)}.json`),
      blob(`english/catalog-${sourceHash(next)}.json`),
      blob('uploads/farm-photo.jpg'),
      blob(`english/catalog-${'c'.repeat(64)}.json`,new Date().toISOString()),
    ]}),put:async pathname=>({url:`${origin}/${pathname}`}),
    remove:async urls=>deleted.push(...urls),
  });
  assert.equal((await store.publish(next)).changed,true);
  assert.deepEqual(deleted,[`${origin}/english/catalog-${oldDigest}.json`]);
});
test('retention failure does not turn a completed pointer update into an ambiguous failed publication',async()=>{
  const c=fixture(),next=structuredClone(c);next.dictionary.Ceviz='Walnuts';
  const store=createCatalogStore({seed:c,
    list:async({prefix})=>{if(prefix!==POINTER_PATH)throw new Error('cleanup unavailable');return {blobs:[]};},
    put:async pathname=>({url:`${origin}/${pathname}`}),remove:async()=>{},
  });
  const result=await store.publish(next);
  assert.equal(result.changed,true);assert.equal(result.cleanupPending,true);
});
test('disabled synchronization and anonymous writes cannot touch storage',async()=>{
  for(const [enabled,authenticated,status]of [[false,true,503],[true,false,401]]){
    let calls=0;
    const handler=createEnglishSyncHandler({enabled,authenticate:async()=>authenticated,
      store:{publish:async()=>{calls++;}},readSources:async()=>{throw new Error('not reached');}});
    const res=response();await handler({method:'POST',headers:{}},res);
    assert.equal(res.statusCode,status);assert.equal(calls,0);
  }
});
test('signed uploads must match the current public records before they are stored',async()=>{
  const c=fixture(),live=structuredClone(c.source);live.listings[0].title='Changed';
  let calls=0;
  const handler=createEnglishSyncHandler({enabled:true,authenticate:async()=>true,
    store:{publish:async()=>{calls++;}},readSources:async()=>live});
  const res=response();
  await handler({method:'POST',headers:{'content-type':'application/gzip'},body:gzipSync(JSON.stringify(c))},res);
  assert.equal(res.statusCode,409);assert.equal(calls,0);
});
test('a valid signed complete edition is accepted without database writes',async()=>{
  const c=fixture();let saved;
  const handler=createEnglishSyncHandler({enabled:true,authenticate:async()=>true,
    store:{publish:async value=>{saved=value;return {changed:true};}},readSources:async()=>c.source});
  const res=response();
  await handler({method:'POST',headers:{'content-type':'application/gzip'},body:gzipSync(JSON.stringify(c))},res);
  assert.equal(res.statusCode,200);assert.equal(saved.sourceRevision,c.sourceRevision);
});
test('unchanged source never loads inference or requests an OIDC credential',async()=>{
  const c=fixture();
  const result=await runEnglishWorker({readPrevious:async()=>c,readSources:async()=>c.source,
    prepare:()=>assert.fail('inference'),acquireToken:()=>assert.fail('token')});
  assert.equal(result.changed,false);
});
test('worker dry run validates and compresses without transmitting or requesting credentials',async()=>{
  const c=fixture(),source=structuredClone(c.source);source.listings[0].price=200;
  const next={...c,source,sourceRevision:sourceRevision(source)};
  const result=await runEnglishWorker({readPrevious:async()=>c,readSources:async()=>source,
    prepare:async()=>next,dryRun:true,request:()=>assert.fail('network'),acquireToken:()=>assert.fail('token')});
  assert.equal(result.dryRun,true);assert.equal(result.bytes>0,true);
});
test('English production HTML uses built scripts and escaped translation data, never a dev server',()=>{
  const c=fixture();c.dictionary.extra='</script><script>alert(1)</script>';
  const page=pageForUrl(new URL('https://www.pazartarla.com.tr/en/'),c);
  const html=liveEnglishDocument(template,page,c,{indexable:true});
  assert.match(html,/<html lang="en">/);
  assert.match(html,/name="robots" content="index,follow"/);
  assert.match(html,/hreflang="tr"/);
  assert.match(html,/await import\("\/assets\/english-test\.js"\)/);
  assert.doesNotMatch(html,/<script>alert\(1\)/);
  assert.doesNotMatch(html,/\/src\/main|English test version|read-only preview/);
  assert.match(liveEnglishDocument(template,page,c),/noindex,nofollow,noarchive/);
});
test('English sitemap lists reciprocal original IDs and real article slugs',()=>{
  const xml=englishSitemap(fixture());
  assert.match(xml,/\/en\/listing\/1/);assert.match(xml,/\/ilan\/1/);
  assert.match(xml,/\/en\/gazette\/haber\/hasat/);assert.match(xml,/hreflang="tr"/);
});
test('English runtime serves real public pages and rejects private, changed and removed records',async()=>{
  const c=fixture();let rows=c.source.listings,clock=Date.now();
  const handler=createEnglishReadHandler({store:{read:async()=>c},templates:{marketplace:template,gazette:template},
    request:async()=>new Response(JSON.stringify({listings:rows})),indexable:true,now:()=>clock});
  let res=response();await handler({method:'GET',url:'/en/'},res);assert.equal(res.statusCode,200);
  res=response();await handler({method:'GET',url:'/_english/public-api/admin-users'},res);assert.equal(res.statusCode,403);
  rows=[{...rows[0],title:'Changed'}];
  clock+=61000;
  res=response();await handler({method:'GET',url:'/en/listing/1'},res);assert.equal(res.statusCode,503);
  assert.equal(res.headers['X-Robots-Tag'],'noindex, nofollow, noarchive');
  rows=[];clock+=61000;
  res=response();await handler({method:'GET',url:'/en/listing/1'},res);assert.equal(res.statusCode,404);
  res=response();await handler({method:'POST',url:'/en/'},res);assert.equal(res.statusCode,405);
});
test('catalogue response and public read headers use the same revision',async()=>{
  const c=fixture();
  const handler=createEnglishReadHandler({store:{read:async()=>c},templates:{marketplace:template,gazette:template},
    request:async()=>new Response(JSON.stringify({listings:c.source.listings}))});
  const res=response();await handler({method:'GET',url:'/_english/public-api/public-listings'},res);
  assert.equal(res.headers['X-PT-English-Catalog'],sourceHash(c.dictionary));
  assert.equal(res.statusCode,200);
});
test('hashed English JavaScript and CSS resolve as static files before the dynamic English API namespace',()=>{
  const routes=englishDeploymentRoutes();
  for(const path of ['/_english/marketplace/assets/index-Ab123456.js','/_english/marketplace/assets/index-Ab123456.css']){
    const first=routes.find(route=>new RegExp('^'+route.src+'$').test(path));
    assert.ok(first);assert.match(first.dest,/^\/_english\/marketplace\/assets\//);
    assert.doesNotMatch(first.dest,/\/api\//);
  }
  const runtime=routes.find(route=>new RegExp('^'+route.src+'$').test('/_english/runtime.js'));
  assert.match(runtime.dest,/\/api\/index\.js/);
});
test('read-only preview listing bridge forwards neither credentials nor arbitrary query parameters',async()=>{
  let sent;
  const handler=createPreviewPublicListingsHandler({request:async(url,options)=>{
    sent={url,options};return new Response(JSON.stringify({listings:[{id:1}]}));
  }});
  const res=response();
  await handler({method:'GET',query:{admin:'1'},headers:{authorization:'private',cookie:'private'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(sent.url,'https://www.pazartarla.com.tr/api/public-listings');
  assert.deepEqual(sent.options.headers,{accept:'application/json'});
});
test('preview source bridge supports public advertisements but refuses writes and private resources',async()=>{
  let calls=0;
  const handler=createPreviewPublicListingsHandler({request:async url=>{
    calls++;assert.equal(url,'https://www.pazartarla.com.tr/api/public-listings?resource=advertisements');
    return new Response(JSON.stringify({advertisements:[]}));
  }});
  let res=response();await handler({method:'GET',query:{resource:'advertisements'}},res);assert.equal(res.statusCode,200);
  res=response();await handler({method:'GET',query:{resource:'admin-users'}},res);assert.equal(res.statusCode,404);
  res=response();await handler({method:'POST',query:{}},res);assert.equal(res.statusCode,405);
  assert.equal(calls,1);
});
test('manual connection verification transfers unchanged genuine public data without inference',async()=>{
  const previous=fixture(),source={...previous.source,checkedAt:new Date().toISOString()};
  let tokenCalls=0,uploads=0,modelCalls=0;
  const result=await runEnglishWorker({readSources:async()=>source,readPrevious:async()=>previous,
    verifyConnection:true,prepare:async()=>{modelCalls++;throw new Error('Unnecessary inference');},
    acquireToken:async()=>{tokenCalls++;return 'synthetic-unit-token';},onProgress:()=>{},
    request:async(url,options)=>{
      uploads++;assert.equal(url,'https://www.pazartarla.com.tr/api/english-sync');
      assert.equal(options.method,'POST');
      const sent=JSON.parse(gunzipSync(options.body));
      validateCatalog(sent,{fresh:true});assert.deepEqual(sent.source,JSON.parse(JSON.stringify(source)));
      assert.deepEqual(sent.dictionary,previous.dictionary);
      return new Response(JSON.stringify({ok:true,version:'unchanged'}));
    }});
  assert.equal(result.changed,false);assert.equal(result.verified,true);
  assert.equal(tokenCalls,1);assert.equal(uploads,1);assert.equal(modelCalls,0);
});
test('dry-run connection verification cannot acquire credentials or publish',async()=>{
  const previous=fixture();
  const fail=()=>{throw new Error('Unexpected external action');};
  const result=await runEnglishWorker({readSources:async()=>previous.source,readPrevious:async()=>previous,
    verifyConnection:true,dryRun:true,prepare:fail,acquireToken:fail,request:fail});
  assert.equal(result.changed,false);assert.equal(result.dryRun,true);
});
