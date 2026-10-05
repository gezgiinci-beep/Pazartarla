// Isolated disposable PostgreSQL. No live URLs, secrets or real accounts.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'annual-store-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const monthly='00000000-0000-4000-8000-000000000001',yearly='00000000-0000-4000-8000-000000000002';
const admin='00000000-0000-4000-8000-000000000003',unverified='00000000-0000-4000-8000-000000000004';
const mid='10000000-0000-4000-8000-000000000001',yid='10000000-0000-4000-8000-000000000002';
let c,running=false;
async function as(uid,role='authenticated'){
  await c.query('RESET ROLE');await c.query("SELECT set_config('test.uid',$1,false)",[uid||'']);
  await c.query('SET ROLE '+role);
}
const rpc=(action,id,revision,payload)=>c.query('SELECT public.manage_store_membership($1,$2,$3,$4) v',[action,id,revision,payload]);
const quota=async()=>(await c.query('SELECT public.get_listing_submission_quota() v')).rows[0].v;
const data=async(version='v2')=>(await c.query(`SELECT public.get_store_membership_data${version==='v2'?'_v2':''}(NULL) v`)).rows[0].v;
const listing=()=>c.query("INSERT INTO public.listings(title,status) VALUES('Synthetic annual listing','pending') RETURNING id");
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63381`,'-w','start'],{env});
  running=true;c=new pg.Client({host:dir,port:63381,user:'safety_test',database:'postgres',ssl:false});await c.connect();
  await c.query(`
    CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false);
    INSERT INTO auth.users VALUES('${monthly}','monthly@test.invalid',now(),false),('${yearly}','annual@test.invalid',now(),false),
      ('${admin}','admin@test.invalid',now(),false),('${unverified}','unverified@test.invalid',NULL,false);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT jsonb_build_object('email',(SELECT email FROM auth.users WHERE id=auth.uid())) $$;
    CREATE TABLE public.listings(id serial PRIMARY KEY,title text,status text,created_at timestamptz DEFAULT now(),
      price numeric,category text,"subCategory" text,location text,description text,seller text,phone text,seotags text,image text,mode text);
    CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
    INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz"]}');
    INSERT INTO public.listings(title,status,image,seotags) VALUES('Legacy preserved','approved','https://example.invalid/original','KEEP_METADATA');
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO anon,authenticated;`);
  for(const name of ['20261003_secure_listing_admin.sql','20261004_moderated_submissions.sql','20261004_unlimited_admin_submissions.sql','20261004_listing_expiry.sql'])
    await c.query(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await c.query("INSERT INTO private.listing_admins(email) VALUES('admin@test.invalid')");
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261004_owner_listing_edit.sql',import.meta.url),'utf8'));
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261004_store_memberships.sql',import.meta.url),'utf8'));
  await as(monthly);await rpc('request',mid,null,{plan_id:'package-1',store_name:'Existing monthly store'});
  await as(admin);await rpc('approve',mid,1,{payment_confirmed:true,payment_reference:'MONTHLY-PAYMENT-1'});
  await c.query('RESET ROLE');
  const originalListing=(await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v;
  const usersBefore=(await c.query('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) v FROM auth.users u')).rows[0].v;
  const monthlySnapshot=(await c.query('SELECT to_jsonb(m) v FROM private.store_memberships m WHERE owner_id=$1',[monthly])).rows[0].v;
  const oldRequests=(await c.query('SELECT jsonb_agg(to_jsonb(r) ORDER BY id) v FROM private.store_requests r')).rows[0].v;
  const oldPayments=(await c.query('SELECT jsonb_agg(to_jsonb(p) ORDER BY reference) v FROM private.store_payment_log p')).rows[0].v;
  const sql=await readFile(new URL('../supabase/reviewed_changes/20261005_annual_unlimited_store_plan.sql',import.meta.url),'utf8');
  await c.query(sql);await c.query(sql);
  const after=(await c.query("SELECT to_jsonb(m)-'billing_period' v FROM private.store_memberships m WHERE owner_id=$1",[monthly])).rows[0].v;
  assert.deepEqual(after,monthlySnapshot);
  assert.deepEqual((await c.query("SELECT jsonb_agg(to_jsonb(r)-'billing_period'-'annual_price_try' ORDER BY id) v FROM private.store_requests r")).rows[0].v,oldRequests);
  assert.deepEqual((await c.query('SELECT jsonb_agg(to_jsonb(p) ORDER BY reference) v FROM private.store_payment_log p')).rows[0].v,oldPayments);
  await as(null,'anon');const publicData=await data();
  assert.equal(publicData.plans.length,3);
  assert.deepEqual(publicData.plans.map(p=>[p.id,p.monthly_price_try,p.annual_price_try,p.monthly_limit,p.active_limit]),
    [['package-1',350,null,30,100],['package-2',500,null,150,250],['package-3',null,2500,null,null]]);
  assert.equal((await data('legacy')).plans.length,2);
  assert.equal(publicData.mine,null);assert.deepEqual(publicData.requests,[]);
  assert(!JSON.stringify(publicData).includes('@test.invalid'));
  await assert.rejects(()=>rpc('request',yid,null,{plan_id:'package-3',store_name:'Denied anon'}));
  await as(unverified);await assert.rejects(()=>rpc('request',yid,null,{plan_id:'package-3',store_name:'Denied unverified'}),/MEMBERSHIP_VERIFIED_REQUIRED/);
  await as(yearly);
  for(let i=0;i<3;i++)await listing();
  await assert.rejects(listing,/LISTING_DAILY_LIMIT_REACHED/);
  await rpc('request',yid,null,{plan_id:'package-3',store_name:'Annual synthetic store',
    annual_price_try:1,billing_period:'month',monthly_limit:99999,active_limit:99999,ends_at:'2099-01-01'});
  assert.equal((await quota()).unlimited,false);
  await assert.rejects(listing,/LISTING_DAILY_LIMIT_REACHED/);
  await assert.rejects(()=>rpc('approve',yid,1,{payment_confirmed:true,payment_reference:'OWN-APPROVAL-1'}),/MEMBERSHIP_ADMIN_REQUIRED/);
  await as(admin);
  await assert.rejects(()=>rpc('approve',yid,1,{payment_confirmed:false,payment_reference:'ANNUAL-PAYMENT-1'}),/MEMBERSHIP_PAYMENT_REQUIRED/);
  await assert.rejects(()=>rpc('approve',yid,1,{payment_confirmed:true,payment_reference:'MONTHLY-PAYMENT-1'}),/MEMBERSHIP_PAYMENT_USED/);
  const annualRequest=(await data()).requests.find(r=>r.id===yid);
  assert.equal(annualRequest.annual_price_try,2500);assert.equal(annualRequest.billing_period,'year');
  assert.equal(annualRequest.monthly_limit,null);assert.equal(annualRequest.active_limit,null);
  assert(!(await data('legacy')).requests.some(r=>r.id===yid));
  await c.query('RESET ROLE');
  await c.query("UPDATE private.store_plans SET annual_price_try=2600 WHERE id='package-3'");
  await as(admin);await rpc('approve',yid,1,{payment_confirmed:true,payment_reference:'ANNUAL-PAYMENT-1',amount_try:1});
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT amount_try::int n FROM private.store_payment_log WHERE request_id=$1',[yid])).rows[0].n,2500);
  assert.equal((await c.query(`SELECT ends_at=(((starts_at AT TIME ZONE 'Europe/Istanbul')+interval '1 year') AT TIME ZONE 'Europe/Istanbul') ok
    FROM private.store_memberships WHERE owner_id=$1`,[yearly])).rows[0].ok,true);
  const endBefore=(await c.query('SELECT ends_at FROM private.store_memberships WHERE owner_id=$1',[yearly])).rows[0].ends_at;
  const leap=(await c.query(`SELECT ((timestamptz '2028-02-29 09:00:00+03' AT TIME ZONE 'Europe/Istanbul')+interval '1 year') AT TIME ZONE 'Europe/Istanbul' d`)).rows[0].d;
  assert.equal(leap.toISOString(),'2029-02-28T06:00:00.000Z');
  await as(admin);await rpc('approve',yid,1,{payment_confirmed:true,payment_reference:'ANNUAL-PAYMENT-1'});
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT ends_at FROM private.store_memberships WHERE owner_id=$1',[yearly])).rows[0].ends_at.toISOString(),endBefore.toISOString());
  await c.query("UPDATE private.store_plans SET annual_price_try=2500 WHERE id='package-3'");
  await as(yearly);
  assert.equal((await quota()).period,'membership_year');assert.equal((await quota()).unlimited,true);
  assert.equal((await quota()).remaining,null);assert.equal((await quota()).active_limit,null);
  assert.equal((await c.query('SELECT public.is_listing_admin() v')).rows[0].v,false);
  assert.equal((await data()).mine.membership.billing_period,'year');
  assert.equal((await data('legacy')).mine.membership,null);
  await c.query("INSERT INTO public.listings(title,status) SELECT 'Unlimited synthetic '||n,'pending' FROM generate_series(1,301) n");
  const ownPending=(await listing()).rows[0].id;
  // RLS may safely deny the write by filtering the row rather than throwing.
  const selfApproval=await c.query("UPDATE public.listings SET status='approved' WHERE id=$1",[ownPending]);
  assert.equal(selfApproval.rowCount,0);
  await as(admin);
  await c.query("UPDATE public.listings SET status='approved' WHERE submitted_by=$1 AND status='pending'",[yearly]);
  await as(yearly);const q=await quota();
  assert(q.active_used>250);assert(q.used>150);assert.equal(q.pending_reserved,0);
  await c.query('RESET ROLE');
  assert.equal((await c.query(`SELECT count(*)::int n FROM public.listings WHERE submitted_by=$1 AND expires_at
    IS DISTINCT FROM (((created_at AT TIME ZONE 'Europe/Istanbul')+interval '8 months') AT TIME ZONE 'Europe/Istanbul')`,[yearly])).rows[0].n,0);
  const listingCount=(await c.query('SELECT count(*)::int n FROM public.listings WHERE submitted_by=$1',[yearly])).rows[0].n;
  await c.query("UPDATE private.store_memberships SET starts_at=now()-interval '1 year',ends_at=now()-interval '1 second' WHERE owner_id=$1",[yearly]);
  await as(yearly);assert.equal((await quota()).period,'rolling_day');assert.equal((await quota()).unlimited,false);
  await assert.rejects(listing,/LISTING_DAILY_LIMIT_REACHED/);
  const renewal='10000000-0000-4000-8000-000000000003';
  await rpc('request',renewal,null,{plan_id:'package-1',store_name:'Downgrade preserves listings'});
  await as(admin);await assert.rejects(()=>rpc('approve',renewal,1,{payment_confirmed:true,payment_reference:'DOWNGRADE-PAYMENT-1'}),/MEMBERSHIP_ACTIVE_LIMIT/);
  await rpc('reject',renewal,1,{});
  await as(monthly);assert.equal((await quota()).period,'membership_month');assert.equal((await quota()).limit,30);assert.equal((await quota()).active_limit,100);
  await as(admin);assert.equal((await quota()).unlimited,true);
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT count(*)::int n FROM public.listings WHERE submitted_by=$1',[yearly])).rows[0].n,listingCount);
  assert.deepEqual((await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v,originalListing);
  assert.deepEqual((await c.query('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) v FROM auth.users u')).rows[0].v,usersBefore);
  assert.equal((await c.query('SELECT count(*)::int n FROM private.store_payment_log')).rows[0].n,2);
  console.log('PASS annual package SQL: 2500/year, genuine unlimited >250 active and >150 submissions, calendar year/leap day, verified manual payment, price snapshot, retries, legacy compatibility, no admin bypass, expiry/downgrade safeguards, unchanged monthly plans/listings/accounts/media.');
  const trialSql=await readFile(new URL('../supabase/reviewed_changes/20261005_free_store_trial.sql',import.meta.url),'utf8');
  await c.query(trialSql);await c.query(trialSql);
  const startTrial=(id,payload={})=>c.query('SELECT public.start_store_trial($1,$2,$3,$4) v',
    ['trial_start',id,null,{plan_id:'trial-30-days',store_name:'Synthetic free store',...payload}]);
  const trialData=async()=>(await c.query('SELECT public.get_store_membership_data_v3(NULL) v')).rows[0].v;
  const tid='20000000-0000-4000-8000-000000000001';
  await as(null,'anon');assert.equal((await trialData()).plans.length,4);
  assert.equal((await trialData()).plans[3].id,'trial-30-days');
  assert.equal((await data()).plans.length,3);assert.equal((await data('legacy')).plans.length,2);
  assert.equal((await trialData()).mine,null);
  await assert.rejects(()=>startTrial(tid));
  await as(unverified);await assert.rejects(()=>startTrial(tid),/MEMBERSHIP_VERIFIED_REQUIRED/);
  await as(monthly);await assert.rejects(()=>startTrial(tid),/MEMBERSHIP_ACTIVE/);
  await as(yearly);
  await assert.rejects(()=>rpc('request',tid,null,{plan_id:'trial-30-days',store_name:'Wrong paid route'}),/MEMBERSHIP_TRIAL_DIRECT_ONLY/);
  const priorStore=(await trialData()).mine.store.id;
  await startTrial(tid,{trial_days:999,annual_price_try:1,monthly_limit:1,ends_at:'2099-01-01',payment_confirmed:false});
  const firstTrial=await trialData();
  assert.equal(firstTrial.mine.trial_used,true);assert.equal(firstTrial.mine.store.id,priorStore);
  assert.equal(firstTrial.mine.membership.billing_period,'trial');
  assert.equal(firstTrial.mine.membership.trial_days,30);
  assert.equal(Date.parse(firstTrial.mine.membership.ends_at)-Date.parse(firstTrial.mine.membership.starts_at),30*86400000);
  assert.equal((await quota()).period,'membership_trial');assert.equal((await quota()).unlimited,true);
  assert.equal((await c.query('SELECT public.is_listing_admin() v')).rows[0].v,false);
  assert.equal((await data()).mine.membership,null);
  await startTrial(tid);
  assert.equal((await trialData()).mine.membership.ends_at,firstTrial.mine.membership.ends_at);
  await assert.rejects(()=>startTrial('20000000-0000-4000-8000-000000000002'),/MEMBERSHIP_TRIAL_USED/);
  await assert.rejects(()=>c.query('SELECT * FROM private.store_trial_ledger'));
  await c.query("INSERT INTO public.listings(title,status) SELECT 'Free unlimited synthetic '||n,'pending' FROM generate_series(1,151) n");
  const tq=await quota();assert(tq.used>150);assert(tq.active_used>250);assert.equal(tq.remaining,null);
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT count(*)::int n FROM private.store_payment_log')).rows[0].n,2);
  await c.query("UPDATE private.store_memberships SET starts_at=now()-interval '30 days',ends_at=now()-interval '1 second' WHERE owner_id=$1",[yearly]);
  await as(yearly);assert.equal((await quota()).period,'rolling_day');assert.equal((await trialData()).mine.trial_used,true);
  await assert.rejects(()=>startTrial(tid),/MEMBERSHIP_TRIAL_USED/);
  const paidAfterTrial='20000000-0000-4000-8000-000000000003';
  await rpc('request',paidAfterTrial,null,{plan_id:'package-3',store_name:'Paid after trial'});
  await as(admin);await rpc('approve',paidAfterTrial,1,{payment_confirmed:true,payment_reference:'AFTER-TRIAL-PAYMENT-1'});
  await as(yearly);const paid=await trialData();
  assert.equal(paid.mine.membership.billing_period,'year');assert.equal(paid.mine.membership.trial_days,null);
  assert.equal(paid.mine.trial_used,true);assert.equal((await quota()).period,'membership_year');
  await assert.rejects(()=>startTrial(tid),/MEMBERSHIP_TRIAL_USED/);
  // Two simultaneous requests from one fresh verified account cannot create two trials.
  await c.query('RESET ROLE');const raceUser='00000000-0000-4000-8000-000000000005';
  await c.query("INSERT INTO auth.users VALUES($1,'race@test.invalid',now(),false)",[raceUser]);
  const racers=[new pg.Client({host:dir,port:63381,user:'safety_test',database:'postgres',ssl:false}),
    new pg.Client({host:dir,port:63381,user:'safety_test',database:'postgres',ssl:false})];
  try{
    for(const client of racers){
      await client.connect();await client.query("SELECT set_config('test.uid',$1,false)",[raceUser]);await client.query('SET ROLE authenticated');
    }
    const results=await Promise.allSettled(racers.map((client,i)=>client.query('SELECT public.start_store_trial($1,$2,NULL,$3)',
      ['trial_start',`30000000-0000-4000-8000-00000000000${i+1}`,{plan_id:'trial-30-days',store_name:'Concurrent synthetic trial'}])));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected'&&/MEMBERSHIP_TRIAL_USED/.test(r.reason.message)).length,1);
  }finally{for(const client of racers)await client.end();}
  assert.equal((await c.query('SELECT count(*)::int n FROM private.store_trial_ledger WHERE owner_id=$1',[raceUser])).rows[0].n,1);
  assert.equal((await c.query('SELECT count(*)::int n FROM private.store_payment_log')).rows[0].n,3);
  assert.deepEqual((await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v,originalListing);
  console.log('PASS free-trial SQL: verified instant activation, exactly 30 days, unlimited, once-per-account ledger/race, no payment/admin role, lost-ack retries, expiry/no renewal, paid transition, unchanged legacy catalogs and original listing/media.');
}catch(error){console.error('Annual plan local SQL failed:',error.code||error.name,error.stack||error.message);process.exitCode=1;}
finally{
  if(c)await c.end();
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}
