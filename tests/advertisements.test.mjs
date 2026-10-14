import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_ACCEPT, adFile, adFields, adSaveFields, adMediaUrl, parseAd, readAds, readPublicAdvertisementsFromApi, mutateAd, AdConflictError, adPublicationConfirmation } from '../src/lib/advertisements.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
const id='00000000-0000-4000-8000-000000000001';
const ad={id,title:'Tarım tanıtımı',target_url:null,media_path:id+'/00000000-0000-4000-8000-000000000002.jpg',media_type:'image',is_active:true,revision:1,created_at:'2026-10-04T00:00:00Z'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
test('image and video validation enforces MIME types and independent limits',()=>{
  assert.deepEqual(adFile({type:'image/jpeg',size:10}),{extension:'jpg',media_type:'image'});
  assert.deepEqual(adFile({type:'video/mp4',size:40*1024*1024}),{extension:'mp4',media_type:'video'});
  for(const file of [{type:'image/svg+xml',size:10},{type:'image/png',size:0},{type:'image/jpeg',size:11*1024*1024},{type:'video/webm',size:51*1024*1024}]) assert.throws(()=>adFile(file));
});
test('optional destination is cleared explicitly; executable URLs and credential URLs are rejected',()=>{
  assert.deepEqual(adFields(' Tanıtım ',' ',false),{title:'Tanıtım',target_url:null,is_active:false});
  for(const url of ['javascript:alert(1)','data:text/html,test','https://user:password@example.invalid','not-a-url']) assert.throws(()=>adFields('Title',url,true));
  assert.throws(()=>adFields(' ', '',true));
});
test('a new ad is always saved hidden; editing preserves its reviewed status',()=>{
  assert.equal(adSaveFields({title:'Taslak',target_url:'',is_active:true,existing:null}).is_active,false);
  assert.equal(adSaveFields({title:'Yayındaki reklam',target_url:'',is_active:true,existing:ad}).is_active,true);
  assert.equal(adSaveFields({title:'Durdurulmuş reklam',target_url:'',is_active:false,existing:ad}).is_active,false);
});
test('records and storage URLs use object paths, never file bytes or base64 in the database',()=>{
  assert.equal(parseAd(ad),ad);
  assert.match(adMediaUrl('https://example.invalid/',ad),/\/storage\/v1\/object\/public\/site-advertisements\//);
  assert.throws(()=>parseAd({...ad,media_path:'data:image/png;base64,test'}));
});
test('public reads are uncached and show explicit missing-backend and malformed-response failures',async()=>{
  const rows=await readAds('https://example.invalid',{apikey:'public'},async(_url,init)=>{
    assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,undefined);return json([ad]);
  });
  assert.deepEqual(rows,[ad]);
  await assert.rejects(readAds('https://example.invalid',{},async()=>json({},404)),/kurulmamış/);
  await assert.rejects(readAds('https://example.invalid',{},async()=>json({})),/yüklenemedi/);
});
test('public Turso advertisement reads use same-origin cached API and validate returned rows',async()=>{
  const rows=await readPublicAdvertisementsFromApi('/api/public-listings',async(path,init)=>{
    assert.equal(path,'/api/public-listings?resource=advertisements');
    assert.equal(init.credentials,'same-origin');
    assert.equal(init.cache,'default');
    assert.deepEqual(init.headers,{Accept:'application/json'});
    return json({advertisements:[ad]});
  });
  assert.deepEqual(rows,[ad]);
  await assert.rejects(readPublicAdvertisementsFromApi('https://example.invalid/api/public-listings'),/adresi geçersiz/);
  await assert.rejects(readPublicAdvertisementsFromApi('/api/public-listings',async()=>json({})),/alınamadı/);
});
test('create returns acknowledged canonical metadata with storage path rather than file payload',async()=>{
  const body={id,title:ad.title,target_url:null,media_path:ad.media_path,media_type:'image',is_active:true};
  assert.deepEqual(await mutateAd('https://example.invalid',{Authorization:'Bearer test'},'POST',id,undefined,body,async(_url,init)=>{
    assert.equal(init.method,'POST');assert.equal(init.headers.Prefer,'return=representation');assert.deepEqual(JSON.parse(init.body),body);return json([ad],201);
  }),ad);
});
test('metadata edit and pause are revision checked; rejected and stale saves do not report success',async()=>{
  const updated={...ad,is_active:false,revision:2};
  assert.deepEqual(await mutateAd('https://example.invalid',{},'PATCH',id,1,{is_active:false},async(url,init)=>{
    assert.match(url,/revision=eq.1/);assert.deepEqual(JSON.parse(init.body),{is_active:false});return json([updated]);
  }),updated);
  await assert.rejects(mutateAd('https://example.invalid',{},'PATCH',id,1,{is_active:false},async()=>json([])),AdConflictError);
  await assert.rejects(mutateAd('https://example.invalid',{},'PATCH',id,1,{},async()=>json([ad])),/doğrulamadı/);
  await assert.rejects(mutateAd('https://example.invalid',{},'POST',id,undefined,{},async()=>json({},403)),/yetkili/);
});
test('delete checks snapshot revision and requires a returned record before file cleanup',async()=>{
  assert.deepEqual(await mutateAd('https://example.invalid',{},'DELETE',id,1,null,async(url,init)=>{
    assert.match(url,/revision=eq.1/);assert.equal(init.method,'DELETE');assert.equal(init.body,undefined);return json([ad]);
  }),ad);
  await assert.rejects(mutateAd('https://example.invalid',{},'DELETE',id,1,null,async()=>json([])),AdConflictError);
});

test('publishing and pausing require a clear confirmation message',()=>{
  assert.match(adPublicationConfirmation('Tarım tanıtımı',true),/onaylanıp yayına alınsın mı/);
  assert.match(adPublicationConfirmation('Tarım tanıtımı',true),/tüm ziyaretçilere görünür/);
  assert.match(adPublicationConfirmation('Tarım tanıtımı',false),/duraklatılsın mı/);
});

const managerSource=readFileSync(new URL('../src/components/AdvertisementManager.tsx',import.meta.url),'utf8');
const managerCompiled=await transformWithEsbuild(managerSource,'advertisement-manager.tsx',{jsx:'transform',jsxFactory:'React.createElement',format:'cjs'});
const managerModule={exports:{}};
runInNewContext(managerCompiled.code,{
  React,module:managerModule,exports:managerModule.exports,
  crypto:{randomUUID:()=>id},
  require(path){
    if(path==='react')return React;
    if(path==='../lib/advertisements')return {AD_ACCEPT,adFile,adPublicationConfirmation};
    if(path==='lucide-react')return new Proxy({}, {get:()=>()=>null});
    if(path.endsWith('.css'))return {};
    throw Error(path);
  }
});
test('new advertisements are presented as unpublished drafts with a separate approval action',()=>{
  const state={items:[],loading:false,busy:false,error:'',saveError:'',success:'',warning:'',canCleanup:false,
    refresh(){},save(){},remove(){},retryCleanup(){},mediaUrl(){return '';}};
  const html=renderToStaticMarkup(React.createElement(managerModule.exports.default,{state,onBack(){}}));
  assert.match(html,/Taslağı kaydet/);
  assert.match(html,/Kaydetmek yalnızca taslak oluşturur/);
  assert.match(html,/Yayınlama ve duraklatma ayrı onay ister/);
  assert.doesNotMatch(html,/role="switch"/);
});