import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ANNUAL_STORE_PLAN,parseStoreData,planPriceText,planCapacityText,storePlanChoices,getStoreMembershipData} from '../src/lib/storeMembership.ts';

const monthly={id:'package-1',name:'Paket 1',monthly_price_try:350,monthly_limit:30,active_limit:100};
const second={id:'package-2',name:'Paket 2',monthly_price_try:500,monthly_limit:150,active_limit:250};
const id='00000000-0000-4000-8000-000000000001';
const data=(plans=[monthly,second,ANNUAL_STORE_PLAN])=>({plans,stores:[],store:null,listings:[],mine:null,requests:[]});
const req={...ANNUAL_STORE_PLAN,id,revision:1,plan_id:'package-3',plan_name:'Paket 3',status:'pending',created_at:'2098-01-01T00:00:00Z',store_name:'Synthetic store'};
const require=createRequire(import.meta.url);
const {buildSync}=createRequire(require.resolve('vite/package.json'))('esbuild');
function component(name){
  const code=buildSync({entryPoints:[fileURLToPath(new URL('../src/components/'+name+'.tsx',import.meta.url))],
    bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
  const module={exports:{}};
  new Function('require','module','exports',code)(require,module,module.exports);
  return module.exports.default;
}
const MembershipPage=component('MembershipPage'),Notice=component('MembershipNotice'),Admin=component('MembershipAdmin');
const panel=component('SubmissionAccountPanel');
const session={user:{id,email_confirmed_at:'2098-01-01T00:00:00Z',is_anonymous:false},access_token:'synthetic-SSR-only'};
const state=(d)=>({data:d,loading:false,busy:false,error:'',refresh:async()=>{},action:async()=>true});
const renderPage=(d,s=null)=>renderToStaticMarkup(React.createElement(MembershipPage,{state:state(d),session:s,onSignIn(){},onStore(){},onSubmitted(){}}));

test('Paket 3 is genuinely unlimited and priced annually; the two monthly tiers are unchanged',()=>{
  const parsed=parseStoreData(data());
  assert.equal(planPriceText(parsed.plans[2]),'2.500 TL / yıl');
  assert.equal(planCapacityText(parsed.plans[2]),'Sınırsız ilan · Sınırsız listeleme');
  assert.equal(planPriceText(parsed.plans[0]),'350 TL / ay');
  assert.equal(planPriceText(parsed.plans[1]),'500 TL / ay');
  assert.deepEqual(parsed.plans.slice(0,2),[monthly,second]);
  assert.deepEqual([parsed.plans[2].monthly_limit,parsed.plans[2].active_limit],[null,null]);
});
test('Malformed terms fail explicitly, including partial unlimited limits and contradictory billing',()=>{
  for(const patch of [{annual_price_try:null},{annual_price_try:Infinity},{monthly_price_try:2500},
    {billing_period:'month'},{billing_period:'week'},{monthly_limit:2147483647},{active_limit:250}]){
    assert.throws(()=>parseStoreData(data([{...ANNUAL_STORE_PLAN,...patch}])),/geçerli veri/);
  }
  assert.throws(()=>parseStoreData(data([{...monthly,monthly_limit:null}])),/geçerli veri/);
  assert.throws(()=>planPriceText({...ANNUAL_STORE_PLAN,annual_price_try:null}),/geçersiz/);
});
test('Annual request and membership snapshots validate with unlimited limits',()=>{
  const d=data();d.requests=[req];
  d.mine={store:null,requests:[req],membership:{plan_name:'Paket 3',billing_period:'year',monthly_limit:null,
    active_limit:null,revision:1,starts_at:'2098-01-01T00:00:00Z',ends_at:'2099-01-01T00:00:00Z'}};
  assert.equal(parseStoreData(d).mine.membership.billing_period,'year');
  d.mine.membership.active_limit=100;
  assert.throws(()=>parseStoreData(d),/geçerli veri/);
});
test('Missing annual server plan is a clearly disabled promotion, never a fabricated available plan',()=>{
  const old=data([monthly,second]);
  const choices=storePlanChoices(old.plans);
  assert.equal(choices[2].available,false);
  assert.deepEqual(old.plans,[monthly,second]);
  const html=renderPage(old);
  assert.match(html,/<button[^>]*disabled=""[^>]*data-testid="plan-package-3"|<button[^>]*data-testid="plan-package-3"[^>]*disabled=""/);
  assert.match(html,/data-testid="annual-plan-setup-required"/);
  assert.match(html,/Yönetici kurulumu bekleniyor/);
  assert.match(html,/2\.500 TL \/ yıl/);
  for(const compact of [false,true]){
    const banner=renderToStaticMarkup(React.createElement(Notice,{plans:old.plans,compact,onOpen(){}}));
    assert.match(banner,/Paket 3/);assert.match(banner,/2\.500 TL \/ yıl/);
    assert.match(banner,/[Yy]önetici kurulumu bekleniyor/);
  }
});
test('Installed annual plan is selectable; annual billing/capacity are shown on public and admin surfaces',()=>{
  const html=renderPage(data());
  const annual=html.match(/<button[^>]*data-testid="plan-package-3"[^>]*>/)?.[0];
  assert(annual);assert(!/\sdisabled(?:=|\s|>)/.test(annual));
  assert(!html.includes('data-testid="annual-plan-setup-required"'));
  const banner=renderToStaticMarkup(React.createElement(Notice,{plans:data().plans,onOpen(){}}));
  assert.match(banner,/2\.500 TL \/ yıl/);assert.match(banner,/Sınırsız/);
  const d=data();d.requests=[req];
  const admin=renderToStaticMarkup(React.createElement(Admin,{state:state(d),session,authorized:true,onBack(){}}));
  assert.match(admin,/2\.500 TL \/ yıl/);assert.match(admin,/Sınırsız ilan/);
});
test('Annual quota panel identifies a paid member, not an administrator',()=>{
  const html=renderToStaticMarkup(React.createElement(panel,{session,quota:{email_verified:true,unlimited:true,
    period:'membership_year',limit:null,remaining:null,used:999,active_limit:null,active_used:300,pending_reserved:2,
    plan_name:'Paket 3',membership_ends_at:'2099-01-01T00:00:00Z',next_available_at:null},
    loading:false,busy:false,error:'',message:'',onAuthenticate:async()=>{},onResend:async()=>{},
    onSignOut:async()=>{},onRefresh(){}}));
  assert.match(html,/Paket 3: Sınırsız ilan ve listeleme/);
  assert(!html.includes('Yönetici hesabı:'));
  assert.match(html,/Yıllık üyelik sonu/);
});
test('Only a missing v2 RPC falls back to the legacy monthly endpoint',async()=>{
  const calls=[];
  const result=await getStoreMembershipData('https://example.invalid',{},null,async url=>{
    calls.push(url);
    return /_v[23]$/.test(url)?new Response('{"code":"PGRST202"}',{status:404}):
      new Response(JSON.stringify(data([monthly,second])),{status:200});
  });
  assert.equal(result.plans.length,2);assert.equal(calls.length,3);
  for(const [status,body] of [[401,'{}'],[403,'{}'],[404,'{}'],[500,'{"code":"PGRST202"}']]){
    let n=0;
    await assert.rejects(()=>getStoreMembershipData('https://example.invalid',{},null,async()=>{
      n++;return new Response(body,{status});
    }));
    assert.equal(n,1);
  }
});
test('Annual upgrade remains a reviewed candidate, with calendar-year activation and no listing/media writes',()=>{
  const sql=readFileSync(new URL('../supabase/reviewed_changes/20261005_annual_unlimited_store_plan.sql',import.meta.url),'utf8');
  assert.match(sql,/'package-3','Paket 3',NULL,2500,'year',NULL,NULL/);
  assert.match(sql,/interval '1 year'/);
  assert.match(sql,/r\.billing_period='year' THEN r\.annual_price_try ELSE r\.monthly_price_try/);
  assert(!/\b(?:UPDATE|DELETE FROM|INSERT INTO|ALTER TABLE)\s+(?:public\.listings|auth\.users|storage\.)/i.test(sql));
});
