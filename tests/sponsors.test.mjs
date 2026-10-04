import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceAdAsset} from '../src/lib/adReplacement.ts';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithEsbuild} from 'vite';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
const id='00000000-0000-4000-8000-000000000001';
const ad={id,title:'Synthetic sponsor',target_url:'https://example.invalid/',is_active:true,media_type:'image',revision:1,media_path:id+'/00000000-0000-4000-8000-000000000002.png',created_at:new Date().toISOString()};
const file=new File(['SYNTHETIC'],'logo.png',{type:'image/png'});
const draft={id,title:ad.title,target_url:ad.target_url,is_active:true,file,existing:ad};
test('replacement updates same ID under original revision; old asset cleanup only follows acknowledged new path',async()=>{
  let uploaded='';
  const pending={current:null};
  const result=await replaceAdAsset(draft,pending,{
    read:async()=>ad,prepare:async f=>f,
    upload:async(path,f)=>{uploaded=path;assert.equal(f,file);},
    patch:async(snapshot,fields)=>{assert.equal(snapshot.revision,1);assert.equal(snapshot.id,id);assert.equal(fields.media_path,uploaded);return {...ad,...fields,revision:2};},
    orphan:()=>assert.fail('Not an orphan'),
  });
  assert.equal(result.row.id,id);assert.equal(result.obsoletePath,ad.media_path);
  assert.notEqual(result.row.media_path,ad.media_path);assert.equal(pending.current,null);
});
test('stale snapshot is rejected before upload; failed upload never replaces or removes original',async()=>{
  await assert.rejects(()=>replaceAdAsset(draft,{current:null},{
    read:async()=>({...ad,revision:2}),prepare:async()=>assert.fail(),upload:async()=>assert.fail(),patch:async()=>assert.fail(),orphan:()=>assert.fail(),
  }),/başka bir oturumda/);
  const pending={current:null};
  await assert.rejects(()=>replaceAdAsset(draft,pending,{
    read:async()=>ad,prepare:async f=>f,upload:async()=>{throw new Error('offline');},patch:async()=>assert.fail(),orphan:()=>assert.fail(),
  }),/offline/);
  assert.equal(pending.current,null);
});
test('lost successful response is verified; unknown outcome retains upload and reuses it on retry',async()=>{
  let canonical=ad,uploads=0;
  const pending={current:null};
  const ops={read:async()=>canonical,prepare:async f=>f,upload:async()=>{uploads++;},
    patch:async(_,fields)=>{canonical={...ad,...fields,revision:2};throw new Error('lost response');},orphan:()=>assert.fail()};
  const recovered=await replaceAdAsset(draft,pending,ops);
  assert.equal(recovered.row.media_path,canonical.media_path);assert.equal(pending.current,null);
  canonical=ad;let attempt=0;
  ops.patch=async(_,fields)=>{if(!attempt++)throw new Error('network');return {...ad,...fields,revision:2};};
  await assert.rejects(()=>replaceAdAsset(draft,pending,ops),/network/);
  const retained=pending.current.path;const uploadCount=uploads;
  const retried=await replaceAdAsset(draft,pending,ops);
  assert.equal(retried.row.media_path,retained);assert.equal(uploads,uploadCount);
});
const compiled=await transformWithEsbuild(readFileSync(new URL('../src/components/SponsorPartners.tsx',import.meta.url),'utf8'),'sponsors.tsx',{jsx:'transform',jsxFactory:'React.createElement',format:'cjs'});
const mod={exports:{}};
runInNewContext(compiled.code,{React,module:mod,exports:mod.exports,require(path){if(path==='react')return React;if(path.endsWith('.css'))return {};throw Error(path);}});
const render=(items,options={})=>renderToStaticMarkup(React.createElement(mod.exports.default,{state:{items,loading:false,error:'',refresh(){},mediaUrl:()=>'/synthetic-logo.png',...options},admin:options.admin||false,onManage(){}}));
test('actual sponsor component filters unpublished/video ads, safe links, image loading and admin/empty/error states',()=>{
  const html=render([ad,{...ad,id:'hidden',is_active:false,title:'Hidden'},{...ad,id:'video',media_type:'video',title:'Video'}]);
  assert.match(html,/Sponsorlar \/ Çözüm Ortaklarımız/);
  assert.match(html,/rel="noopener noreferrer sponsored"/);
  assert.match(html,/loading="lazy"/);assert.match(html,/decoding="async"/);
  assert.doesNotMatch(html,/Hidden|>Video|button-manage-sponsors/);
  assert.equal(render([]),'');
  assert.match(render([],{admin:true}),/empty-sponsors/);
  assert.match(render([],{loading:true}),/role="status"/);
  assert.match(render([],{error:'Offline'}),/role="alert"/);
  assert.doesNotMatch(render([{...ad,target_url:null}]),/<a /);
});
export const sponsorPreviewHTML='<!doctype html><html lang="tr"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sponsor alanı — sentetik görsel kontrol</title><style>body{margin:0;padding:24px;background:#f3f5f2;font-family:Arial,sans-serif}main{max-width:1120px;margin:auto}'+readFileSync(new URL('../src/components/sponsors.css',import.meta.url),'utf8')+'</style><main><p>Görsel kontrol — yalnızca sentetik test verileri</p>'+render(Array.from({length:4},(_,i)=>({...ad,id:'synthetic-'+i,title:'Sentetik çözüm ortağı '+(i+1)})),{mediaUrl:a=>'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180"><rect width="420" height="180" fill="#f8faf5"/><path d="M60 120 Q42 55 96 45 Q110 105 60 120" fill="#28543c"/><text x="128" y="98" fill="#28543c" font-family="Arial" font-size="25">TEST '+a.title.slice(-1)+'</text></svg>').toString('base64')})+'</main></html>';