import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ANNUAL_STORE_PLAN,TRIAL_STORE_PLAN,parseStoreData,planPriceText,storePlanChoices} from '../src/lib/storeMembership.ts';
const require=createRequire(import.meta.url);
const {buildSync}=createRequire(require.resolve('vite/package.json'))('esbuild');
const compile=name=>{
  const code=buildSync({entryPoints:[fileURLToPath(new URL('../src/components/'+name+'.tsx',import.meta.url))],
    bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
  const m={exports:{}};new Function('require','module','exports',code)(require,m,m.exports);return m.exports.default;
};
const Page=compile('MembershipPage'),Promo=compile('TrialPromotion'),Panel=compile('SubmissionAccountPanel');
const monthly={id:'package-1',name:'Paket 1',monthly_price_try:350,monthly_limit:30,active_limit:100};
const second={id:'package-2',name:'Paket 2',monthly_price_try:500,monthly_limit:150,active_limit:250};
const valid=()=>({plans:[monthly,second,ANNUAL_STORE_PLAN,TRIAL_STORE_PLAN],stores:[],store:null,listings:[],requests:[],
  mine:{store:null,membership:null,requests:[],trial_used:false}});
const session={user:{id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2098-01-01',is_anonymous:false},access_token:'synthetic-SSR-only'};
const page=d=>renderToStaticMarkup(React.createElement(Page,{state:{data:d,loading:false,busy:false,error:'',action:async()=>true},
  session,initialPlanId:'trial-30-days',onSignIn(){},onStore(){},onSubmitted(){}}));
test('Fourth option is exactly 30 days, free and unlimited, without changing the three paid tiers',()=>{
  const d=parseStoreData(valid());assert.equal(d.plans[3].trial_days,30);assert.equal(planPriceText(d.plans[3]),'30 gün ücretsiz');
  assert.equal(d.plans[3].monthly_limit,null);assert.equal(d.plans[3].active_limit,null);
  const choices=storePlanChoices([TRIAL_STORE_PLAN,monthly,second]);
  assert.deepEqual(choices.map(c=>c.plan.id),['package-1','package-2','package-3','trial-30-days']);
  assert.equal(choices[2].available,false);assert.equal(choices[3].available,true);
  for(const patch of [{trial_days:31},{monthly_limit:100},{monthly_price_try:1},{annual_price_try:1}]){
    const bad=valid();bad.plans[3]={...TRIAL_STORE_PLAN,...patch};assert.throws(()=>parseStoreData(bad),/geçerli veri/);
  }
});
test('Verified users get an immediate trial action, not a bank-transfer application',()=>{
  const html=page(valid());
  assert.match(html,/30 günlük denemeyi başlat/);
  assert.match(html,/data-testid="plan-trial-30-days"/);
  assert.match(html,/Otomatik ücretlendirme|otomatik ücretlendirme/);
  const button=html.match(/<button[^>]*type="submit"[^>]*>30 günlük denemeyi başlat<\/button>/)?.[0];
  assert(button);assert(!/\sdisabled(?:=|\s|>)/.test(button));
  const source=readFileSync(new URL('../src/components/MembershipPage.tsx',import.meta.url),'utf8');
  assert.match(source,/state\.action\(trialSelected \? 'trial_start' : 'request'/);
  assert.match(source,/if \(trialSelected && trialUsed\)/);
  const hook=readFileSync(new URL('../src/hooks/useStoreMembership.ts',import.meta.url),'utf8');
  assert.match(hook,/action==='trial_start'\?'start_store_trial':'manage_store_membership'/);
});
test('Used and missing-backend trial options fail closed while paid options remain available',()=>{
  const used=valid();used.mine.trial_used=true;
  const usedHtml=page(used);
  assert.match(usedHtml,/Bu hesabın ücretsiz deneme hakkı kullanıldı/);
  const trialButton=usedHtml.match(/<button[^>]*data-testid="plan-trial-30-days"[^>]*>/)?.[0];
  assert.match(trialButton,/\sdisabled(?:=|\s|>)/);
  const missing=valid();missing.plans.pop();
  const missingHtml=page(missing);
  assert.match(missingHtml,/data-testid="trial-plan-setup-required"/);
  const missingButton=missingHtml.match(/<button[^>]*data-testid="plan-trial-30-days"[^>]*>/)?.[0];
  assert.match(missingButton,/\sdisabled(?:=|\s|>)/);
});
test('Visual spot is inline, accessible, state-aware and respects reduced motion',()=>{
  const html=renderToStaticMarkup(React.createElement(Promo,{ready:false,used:false,onOpenTrial(){}}));
  assert.match(html,/30 Gün|30 gün/);assert.match(html,/data-testid="trial-promotion-cta"/);
  assert.match(html,/<svg/);assert.match(html,/Kurulum bekleniyor/);
  const css=readFileSync(new URL('../src/components/trial-promotion.css',import.meta.url),'utf8');
  assert.match(css,/prefers-reduced-motion/);assert.match(css,/@keyframes/);
  assert(!/position:\s*fixed/.test(css));
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/setMembershipPreferredPlan\('trial-30-days'\);changeTab\('memberships'\)/);
  assert.match(app,/initialPlanId=\{membershipPreferredPlan\}/);
});
test('Trial quota is never labeled as admin privilege',()=>{
  const html=renderToStaticMarkup(React.createElement(Panel,{session,quota:{email_verified:true,unlimited:true,
    period:'membership_trial',limit:null,remaining:null,used:999,active_used:300,pending_reserved:3,
    plan_name:TRIAL_STORE_PLAN.name,membership_ends_at:'2099-01-01',next_available_at:null},
    loading:false,busy:false,error:'',message:'',onAuthenticate:async()=>{},onResend:async()=>{},onSignOut:async()=>{},onRefresh(){}}));
  assert.match(html,/Ücretsiz deneme sonu/);assert(!html.includes('Yönetici hesabı:'));
});
