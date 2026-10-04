import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithEsbuild} from 'vite';
import * as depot from '../src/lib/contactDepot.ts';
import {runDispatchBatch} from '../server/messageDispatcher.ts';
test('Turkish/international phone normalization matches server contract; malformed targets do not qualify',()=>{
  for(const phone of ['0555 000 00 01','5550000001','905550000001','+905550000001','00905550000001'])
    assert.equal(depot.normalizePhone(phone),'+905550000001');
  assert.equal(depot.normalizePhone('+1 (202) 555-0123'),'+12025550123');
  for(const phone of ['hello','+000','123','555/0000001'])assert.equal(depot.normalizePhone(phone),null);
});
test('manual contact validation requires real name and at least one valid endpoint',()=>{
  const draft={id:null,revision:null,name:'Test',email:'test@example.invalid',phone:''};
  assert.doesNotThrow(()=>depot.validateContact(draft));
  for(const patch of [{name:''},{email:''},{phone:'hello'},{email:'missing-at'}])
    assert.throws(()=>depot.validateContact({...draft,...patch}));
});
const empty={
  contacts:[],total:0,page:0,page_size:50,campaigns:[],
  channels:depot.CHANNELS.map(channel=>({channel,provider:null,enabled:false}))
};
test('reader checks complete fields, permission data and supported provider channels',()=>{
  assert.deepEqual(depot.parseDepotPage(empty),empty);
  assert.throws(()=>depot.parseDepotPage({...empty,channels:[]}));
  assert.throws(()=>depot.parseDepotPage({...empty,total:-1}));
  assert.throws(()=>depot.parseDepotPage({...empty,contacts:[{name:'malformed'}]}));
});
test('requests preserve exact input; stale/duplicate/missing permission proof/access failures are explicit',async()=>{
  let call;
  const args={p_id:null,p_revision:null,p_name:'Test',p_email:'test@example.invalid',p_phone:''};
  await depot.depotRpc('https://test.invalid/',{Authorization:'test'},'save_depot_contact',args,async(url,options)=>{
    call={url,options};return Response.json(randomUUID());
  });
  assert.equal(call.url,'https://test.invalid/rest/v1/rpc/save_depot_contact');
  assert.deepEqual(JSON.parse(call.options.body),args);
  assert.equal(call.options.cache,'no-store');
  for(const [message,text] of [['CONTACT_STALE','başka'],['CONTACT_CONFLICT','başka kayıt'],['CONTACT_EVIDENCE_REQUIRED','kaynağını']])
    await assert.rejects(()=>depot.depotRpc('https://test.invalid',{},'save',{},async()=>Response.json({message},{status:400})),new RegExp(text));
  await assert.rejects(()=>depot.depotRpc('https://test.invalid',{},'get',{},async()=>Response.json({},{status:403})),/yönetici/);
});
const job=()=>({id:randomUUID(),lease:randomUUID(),destination:'test@example.invalid',
  channel:'email',provider:'test-only',subject:'Test',body:'Test',unsubscribe_token:randomUUID()});
test('server worker rechecks permission and supplies stable idempotency and required unsubscribe URL',async()=>{
  const message=job(),finished=[];
  const result=await runDispatchBatch({
    claim:async()=>[message],allowed:async()=>true,
    unsubscribeUrl:token=>'https://example.invalid/?iletisim_cikis='+token,
    send:async(m,context)=>{assert.equal(m.id,message.id);assert.equal(context.idempotencyKey,message.id);
      assert.match(context.unsubscribeUrl,/iletisim_cikis=/);return{accepted:true,providerId:'test-only'};},
    finish:async(...args)=>{finished.push(args);return true;}
  });
  assert.equal(result.sent,1);assert.equal(finished[0][2],'sent');
});
test('revoked delivery never calls transport; uncertain outcomes are unknown and never replayed',async()=>{
  let sent=0;const messages=[job(),job()];let checked=0;const finished=[];
  const result=await runDispatchBatch({
    claim:async()=>messages,allowed:async()=>++checked>1,
    unsubscribeUrl:()=> 'https://example.invalid/?iletisim_cikis=test',
    send:async()=>{sent++;throw Error('network uncertainty');},
    finish:async(...args)=>{finished.push(args);return true;}
  });
  assert.equal(sent,1);assert.equal(result.cancelled,1);assert.equal(result.unknown,1);
  assert.deepEqual(finished.map(f=>f[2]),['cancelled','unknown']);
});
test('transport-free invalid unsubscribe URL or missing write acknowledgement fails, not fake sent',async()=>{
  const base={claim:async()=>[job()],allowed:async()=>true,send:async()=>({accepted:true,providerId:'test'}),
    finish:async()=>true,unsubscribeUrl:()=> 'http://example.invalid/'};
  await assert.rejects(()=>runDispatchBatch(base),/HTTPS/);
  await assert.rejects(()=>runDispatchBatch({...base,unsubscribeUrl:()=> 'https://example.invalid/',finish:async()=>false}),/acknowledged/);
});
async function component(path) {
  const compiled=await transformWithEsbuild(readFileSync(new URL('../src/components/'+path,import.meta.url),'utf8'),
    path,{jsx:'transform',jsxFactory:'React.createElement',format:'cjs'});
  const mod={exports:{}};
  runInNewContext(compiled.code,{React,module:mod,exports:mod.exports,require(p){
    if(p==='react')return React;if(p.endsWith('.css'))return {};
    if(p==='../lib/contactDepot')return depot;throw Error(p);
  }});
  return mod.exports.default;
}
const Manager=await component('ContactDepotManager.tsx');
const Unsubscribe=await component('ContactUnsubscribe.tsx');
const state={data:empty,loading:false,busy:false,error:'',notice:'',search:'',page:0,archived:false,
  refresh(){},searchContacts(){},setPage(){},showArchived(){},saveContact(){},archiveContact(){},savePermission(){},createCampaign(){},cancelCampaign(){}};
const render=(patch={})=>renderToStaticMarkup(React.createElement(Manager,{state:{...state,...patch},onBack(){}}));
test('actual admin interface renders persistence, permissions, errors, empty state and three disconnected channels',()=>{
  const html=render();
  assert.match(html,/Kişi/);assert.match(html,/button-contact-create/);
  for(const label of ['SMS','E-posta','WhatsApp'])assert.ok(html.includes(label));
  assert.match(render({error:'Database denied'}),/role="alert"/);
  assert.match(render({loading:true,data:null}),/Kişi deposu yükleniyor/);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/isAdminLoggedIn \? <ContactDepotManager/);
  assert.match(app,/button-admin-contacts/);
  assert.match(app,/İlan vermek toplu mesaj izni değildir/);
});
test('unsubscribe requires deliberate confirmation; rendering never silently triggers opt-out',()=>{
  const html=renderToStaticMarkup(React.createElement(Unsubscribe,{token:randomUUID(),url:'https://example.invalid',publicKey:'test'}));
  assert.match(html,/Mesaj iznimi kapat/);assert.match(html,/İlanınız silinmez/);
  const source=readFileSync(new URL('../src/components/ContactUnsubscribe.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/useEffect/);
});
if(process.argv.includes('--render-output')) {
  // Empty synthetic visual fixture only. Never render real private contacts on an unauthenticated route.
  const css=readFileSync(new URL('../src/components/contact-depot.css',import.meta.url),'utf8');
  mkdirSync('artifacts/mockup-sandbox/public',{recursive:true});
  writeFileSync('artifacts/mockup-sandbox/public/contact-check.html',`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style><body style="margin:0;background:#f4f6f8"><main style="max-width:600px;margin:auto;padding:12px">${render()}</main></body></html>`);
}