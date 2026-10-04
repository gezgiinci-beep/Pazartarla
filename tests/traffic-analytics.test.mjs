import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithEsbuild} from 'vite';
import {validatePayload,coarseLocation,createHandler} from '../api/traffic.js';
import {browserIdentity,startTrafficTracker} from '../src/lib/trafficTracking.ts';
import * as reportLib from '../src/lib/trafficAnalytics.ts';

function storage() {
  const map=new Map();
  return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
const payload=()=>({view_id:randomUUID(),visitor_id:randomUUID(),session_id:randomUUID(),route:'home',listing_id:null,active_seconds:0});
test('payload is small, explicit, no free text/identity/IP/client geographic fields',()=>{
  const p=payload();assert.ok(validatePayload(p));
  for(const change of [{ip:'1.2.3.4'},{country:'TR'},{email:'user@example.invalid'},{active_seconds:-1},{active_seconds:1.5},{route:'admin-page'},{listing_id:'1'}]) {
    assert.equal(Boolean(validatePayload({...p,...change})),false);
  }
  assert.ok(validatePayload({...p,route:'detail',listing_id:'123'}));
  assert.equal(validatePayload({...p,route:'detail',listing_id:'9223372036854775808'}),false);
});
test('location comes from coarse Vercel headers only; no fallback to fabricated Turkey',()=>{
  assert.deepEqual(coarseLocation({},true),{country:null,region:null});
  assert.deepEqual(coarseLocation({'x-vercel-ip-country':'TR','x-vercel-ip-country-region':'34','x-forwarded-for':'1.2.3.4'},true),{country:'TR',region:'34'});
  assert.deepEqual(coarseLocation({'x-vercel-ip-country':'TR'},false),{country:null,region:null});
  assert.equal(reportLib.regionLabel('TR','34'),'Türkiye · İstanbul');
  assert.equal(reportLib.regionLabel(null,null),'Konum bilinmiyor');
});
async function callApi(body,{origin='https://www.pazartarla.com.tr',method='POST',env={},host='www.pazartarla.com.tr',request}={}) {
  let output={};const res={setHeader(){},status(s){output.status=s;return this;},json(data){output.data=data;return this;}};
  await createHandler({VERCEL:'1',VERCEL_ENV:'production',VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'public-test',...env},request)(
    {method,body,headers:{origin,host,'x-vercel-ip-country':'TR','x-vercel-ip-country-region':'34'}},res);
  return output;
}
test('collector enforces canonical production/origin; acknowledges DB writes; sanitized failures',async()=>{
  let received;
  const request=async(url,options)=>{received={url,body:JSON.parse(options.body)};return Response.json(true);};
  const r=await callApi(payload(),{request});assert.equal(r.status,200);assert.equal(r.data.recorded,true);
  assert.equal(received.body.p_country,'TR');assert.equal(received.body.p_region,'34');
  assert.equal((await callApi(payload(),{origin:'https://attacker.example',request})).status,403);
  assert.equal((await callApi(payload(),{env:{VERCEL_ENV:'preview'},request})).status,503);
  assert.equal((await callApi(payload(),{host:'pazartarla.com.tr',request})).status,503);
  assert.equal((await callApi(payload(),{request:async()=>Response.json({error:'private error'},{status:400})})).status,503);
  assert.equal((await callApi(payload(),{request:async()=>Response.json(false)})).status,503);
  assert.equal((await callApi(undefined,{method:'GET',host:'pazartarla-1.vercel.app',request:async()=>Response.json({ready:true})})).data.ready,true);
});
test('browser identity spans page visits; session renews only after 30 minutes of inactivity',()=>{
  const s=storage(),a=browserIdentity(s,1000,randomUUID),b=browserIdentity(s,2000,randomUUID);
  assert.deepEqual(a,b);
  const c=browserIdentity(s,2000+30*60_000,randomUUID);
  assert.equal(c.visitor_id,a.visitor_id);assert.notEqual(c.session_id,a.session_id);
});
function harness() {
  let time=0,visible=true,allowed=true,next=0,listener,hide;
  const sends=[],timers=new Map();
  const stop=startTrafficTracker({route:'home',listingId:null,storage:storage(),uuid:randomUUID,
    now:()=>1000+time,clock:()=>time,visible:()=>visible,allowed:()=>allowed,
    send:async(p,final)=>{sends.push({p,final});},onError(){},
    schedule:fn=>{timers.set(++next,fn);return next;},repeat:fn=>{timers.set(++next,fn);return next;},
    cancelSchedule:id=>timers.delete(id),cancelRepeat:id=>timers.delete(id),
    listen(fn,onHide){listener=fn;hide=onHide;return()=>{};}
  });
  return {sends,stop,start(){timers.get(1)?.();},advance(ms){time+=ms;listener();},
    visible(v){visible=v;listener();},deny(){allowed=false;},hide(){hide();},timers};
}
test('discarded strict mount does not count; focused time excludes hidden time; pause and final flush are idempotent',()=>{
  const discarded=harness();discarded.stop();assert.equal(discarded.sends.length,0);
  const h=harness();h.start();h.advance(15000);assert.equal(h.sends.at(-1).p.active_seconds,15);
  const id=h.sends[0].p.view_id;h.visible(false);h.advance(300000);h.visible(true);h.advance(15000);
  assert.equal(h.sends.at(-1).p.active_seconds,30);assert.equal(h.sends.at(-1).p.view_id,id);
  h.hide();assert.equal(h.sends.at(-1).final,true);
  h.deny();const n=h.sends.length;h.advance(15000);h.stop();assert.equal(h.sends.length,n);
});
test('session after background inactivity creates a new view and resets duration',()=>{
  const h=harness();h.start();h.advance(15000);const first=h.sends[0].p;
  h.visible(false);h.advance(31*60000);h.visible(true);
  assert.notEqual(h.sends.at(-1).p.session_id,first.session_id);
  assert.equal(h.sends.at(-1).p.active_seconds,0);h.stop();
});
const empty={
  period_days:7,collection_started_at:'2026-10-04T00:00:00Z',window_start:'2026-09-28T00:00:00Z',generated_at:'2026-10-04T00:00:00Z',
  summary:{total_views:0,detail_views:0,unique_browsers:0,total_sessions:0,total_active_seconds:0,avg_session_seconds:0,visits_per_browser:0,returning_rate:0},
  regions:[],region_count:0,listings:[],listing_count:0,daily:Array.from({length:7},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),views:0,sessions:0,active_seconds:0}))
};
test('report boundary rejects malformed data and wrong requested periods; private RPC auth/HTTP errors are clear',async()=>{
  assert.equal(reportLib.parseTrafficReport(empty),empty);
  assert.throws(()=>reportLib.parseTrafficReport({...empty,summary:{}}));
  assert.throws(()=>reportLib.parseTrafficReport({...empty,daily:[]}));
  assert.throws(()=>reportLib.parseTrafficReport({...empty,summary:{...empty.summary,returning_rate:101}}));
  await assert.rejects(()=>reportLib.readTrafficReport('https://db.example',{},30,async()=>Response.json(empty)),/dönem/);
  await assert.rejects(()=>reportLib.readTrafficReport('https://db.example',{},7,async()=>new Response('',{status:403})),/yönetici/);
  let options;
  await reportLib.readTrafficReport('https://db.example',{},7,async(_,o)=>{options=o;return Response.json(empty);});
  assert.deepEqual(JSON.parse(options.body),{p_days:7});assert.equal(options.cache,'no-store');
});
const compiled=await transformWithEsbuild(readFileSync(new URL('../src/components/TrafficDashboard.tsx',import.meta.url),'utf8'),
  'traffic-dashboard.tsx',{jsx:'transform',jsxFactory:'React.createElement',format:'cjs'});
const mod={exports:{}};
runInNewContext(compiled.code,{React,module:mod,exports:mod.exports,require(path){
  if(path.endsWith('.css'))return {};if(path==='../lib/trafficAnalytics')return reportLib;throw Error(path);
}});
const render=state=>renderToStaticMarkup(React.createElement(mod.exports.default,{state:{
  data:empty,days:7,setDays(){},refresh(){},error:'',collectorError:'',loading:false,...state
}}));
test('actual dashboard renders period controls/zero/loading/errors and regional duration/frequency/share',()=>{
  assert.match(render({}),/status-traffic-zero/);
  assert.match(render({loading:true}),/Trafik raporu yükleniyor/);
  assert.match(render({error:'Access denied'}),/role="alert"/);
  assert.match(render({collectorError:'Not deployed'}),/Not deployed/);
  for(const d of [7,30,90])assert.match(render({}),new RegExp('button-traffic-period-'+d));
  const populated={...empty,summary:{...empty.summary,total_views:2},region_count:1,regions:[{
    country:'TR',region:'34',views:2,browsers:1,sessions:2,active_seconds:120,avg_session_seconds:60,visits_per_browser:2,share_percent:100
  }]};
  const html=render({data:populated});assert.match(html,/İstanbul/);assert.match(html,/100%/);assert.match(html,/2 dk 0 sn/);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/isAdminLoggedIn \? <TrafficDashboard/);assert.match(app,/button-admin-statistics/);
  assert.match(app,/<TrafficPrivacy state=\{traffic\}/);
});
const outputIndex=process.argv.indexOf('--render-output');
if(outputIndex!==-1) {
  const actual=reportLib.parseTrafficReport(JSON.parse(readFileSync('/tmp/pazartarla-empty-traffic-report.json','utf8')));
  assert.equal(actual.summary.total_views,0,'Never put real private traffic into an unauthenticated fixture.');
  const css=readFileSync(new URL('../src/components/traffic-dashboard.css',import.meta.url),'utf8');
  mkdirSync('artifacts/mockup-sandbox/public',{recursive:true});
  writeFileSync(process.argv[outputIndex+1],`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0;background:#f4f6f8"><main style="max-width:600px;margin:auto;padding:12px">${render({data:actual})}</main></body></html>`);
}