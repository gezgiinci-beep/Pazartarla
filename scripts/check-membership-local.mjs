// Disposable PostgreSQL only. No production URLs, accounts or credentials.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'membership-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003';
const rid='10000000-0000-4000-8000-000000000001';
let c,running=false;
const config={host:dir,port:63380,user:'safety_test',password:'synthetic-local-only',database:'postgres',ssl:false};
async function as(uid,role='authenticated',client=c){
  await client.query('RESET ROLE');await client.query("SELECT set_config('test.uid',$1,false)",[uid||'']);
  await client.query('SET ROLE '+role);
}
const rpc=(client,action,id,revision,payload)=>client.query('SELECT public.manage_store_membership($1,$2,$3,$4) v',[action,id,revision,payload]);
const data=async(id=null)=>(await c.query('SELECT public.get_store_membership_data($1) v',[id])).rows[0].v;
const quota=async()=>(await c.query('SELECT public.get_listing_submission_quota() v')).rows[0].v;
const listing=async(client=c)=>client.query("INSERT INTO public.listings(title,status) VALUES('Synthetic new','pending') RETURNING *");
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63380`,'-w','start'],{env});running=true;
  c=new pg.Client(config);await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false);
    INSERT INTO auth.users VALUES('${owner}','owner@test.invalid',now(),false),('${other}','other@test.invalid',now(),false),('${admin}','admin@test.invalid',now(),false);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT jsonb_build_object('email',(SELECT email FROM auth.users WHERE id=auth.uid())) $$;
    CREATE TABLE public.listings(id serial PRIMARY KEY,title text,status text,created_at timestamptz DEFAULT now(),
      price numeric,category text,"subCategory" text,location text,description text,seller text,phone text,seotags text,image text,mode text);
    CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
    INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz"]}');
    INSERT INTO public.listings(title,status,image,seotags) VALUES('Legacy ownerless unchanged','approved','https://example.invalid/original','KEEP_METADATA');
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO anon,authenticated;`);
  for(const name of ['20261003_secure_listing_admin.sql','20261004_moderated_submissions.sql','20261004_unlimited_admin_submissions.sql','20261004_listing_expiry.sql'])
    await c.query(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await c.query("INSERT INTO private.listing_admins(email) VALUES('admin@test.invalid')");
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261004_owner_listing_edit.sql',import.meta.url),'utf8'));
  const before=(await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v;
  const usersBefore=(await c.query('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) v FROM auth.users u')).rows[0].v;
  const sql=await readFile(new URL('../supabase/reviewed_changes/20261004_store_memberships.sql',import.meta.url),'utf8');
  await c.query(sql);await c.query(sql); // Reapplication does not reset plans/data.
  assert.deepEqual((await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v,before);
  assert.deepEqual((await c.query('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) v FROM auth.users u')).rows[0].v,usersBefore);
  await as(null,'anon');let d=await data();assert.equal(d.plans[0].monthly_price_try,350);assert.equal(d.plans[1].monthly_limit,150);
  assert.equal(d.mine,null);assert.deepEqual(d.requests,[]);assert.deepEqual(d.stores,[]);
  await assert.rejects(()=>rpc(c,'request',rid,null,{plan_id:'package-1',store_name:'Synthetic store'}),e=>e.code==='42501');
  await as(owner);await listing();await listing();await listing();
  await assert.rejects(()=>listing(),/LISTING_DAILY_LIMIT_REACHED/);
  assert.equal((await quota()).remaining,0);
  const draft={plan_id:'package-1',store_name:'Synthetic store',description:'Test description',monthly_limit:999999,monthly_price_try:1,owner_id:other};
  await rpc(c,'request',rid,null,draft);await rpc(c,'request',rid,null,draft);
  assert.equal((await data()).mine.requests.length,1);assert.equal((await data()).mine.requests[0].monthly_limit,30);
  await assert.rejects(()=>rpc(c,'approve',rid,1,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-1'}),/MEMBERSHIP_ADMIN_REQUIRED/);
  await as(other);assert.deepEqual((await data()).mine.requests,[]);
  await as(admin);assert.equal((await data()).requests[0].email,'owner@test.invalid');
  await assert.rejects(()=>rpc(c,'approve',rid,1,{}),/MEMBERSHIP_PAYMENT_REQUIRED/);
  await assert.rejects(()=>rpc(c,'approve',rid,999,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-1'}),/MEMBERSHIP_STALE/);
  await rpc(c,'approve',rid,1,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-1'});
  const first=(await data()).requests[0];
  await rpc(c,'approve',rid,1,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-1'});assert.equal((await data()).requests[0].revision,first.revision);
  await as(owner);let q=await quota();assert.equal(q.period,'membership_month');assert.equal(q.used,0);assert.equal(q.limit,30);
  assert.equal(q.pending_reserved,3);assert.equal(q.active_limit,100);
  for(let i=0;i<4;i++)await listing(); // Exempt from daily 3.
  d=await data();const store=d.mine.store,period=d.mine.membership;
  await rpc(c,'store',null,store.revision,{store_name:'Updated synthetic store',description:'Updated'});
  await assert.rejects(()=>rpc(c,'store',null,store.revision,{store_name:'Stale overwrite'}),/MEMBERSHIP_STALE/);
  // Public directory never exposes auth IDs, private email or pending content.
  await as(null,'anon');d=await data(store.id);assert.equal(d.store.name,'Updated synthetic store');assert.deepEqual(d.listings,[]);
  assert.doesNotMatch(JSON.stringify(d),/owner@test|owner_id|payment_reference|decided_by/);
  await as(admin);const owned=(await c.query("SELECT id FROM public.listings WHERE submitted_by=$1 ORDER BY id",[owner])).rows;
  await c.query("UPDATE public.listings SET status='approved' WHERE id=$1",[owned[0].id]);
  await as(null,'anon');assert.equal((await data(store.id)).listings.length,1);
  await as(owner);const original=(await c.query('SELECT * FROM public.listings WHERE id=$1',[owned[0].id])).rows[0];
  const logBefore=(await quota()).used;
  const edit=(await c.query('SELECT public.get_listing_for_edit($1) v',[original.id])).rows[0].v;
  await c.query('SELECT public.update_listing_details($1,$2,$3)',[original.id,{title:'Corrected synthetic',price:100,category:'Mahsuller',subCategory:'Ceviz',location:'Test',description:'Correction',seller:'Test seller',phone:'05320000000'},edit.edit_token]);
  assert.equal((await quota()).used,logBefore,'Corrections do not consume another submission');
  await as(admin);await c.query('RESET ROLE');
  // Cap is adjustable here ONLY in this synthetic database to test boundary races.
  await c.query('UPDATE private.store_memberships SET active_limit=8 WHERE owner_id=$1',[owner]);
  await as(owner);await listing();q=await quota();assert.equal(q.remaining,0);
  await assert.rejects(()=>listing(),/LISTING_ACTIVE_LIMIT_REACHED/);
  await c.query('RESET ROLE');await c.query('UPDATE private.store_memberships SET active_limit=100 WHERE owner_id=$1',[owner]);
  // Race at final monthly slot: real triggers and advisory lock, two clients.
  await c.query('UPDATE private.store_memberships SET monthly_limit=9 WHERE owner_id=$1',[owner]); // current used=5
  await as(owner);for(let i=0;i<3;i++)await listing();
  const a=new pg.Client(config),b=new pg.Client(config);await a.connect();await b.connect();
  await as(owner,'authenticated',a);await as(owner,'authenticated',b);
  const race=await Promise.allSettled([listing(a),listing(b)]);await a.end();await b.end();
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal((await quota()).used,9);
  await assert.rejects(()=>listing(),/LISTING_MONTHLY_LIMIT_REACHED/);
  // Approval race must use owner capacity, not exempt the moderating admin.
  await c.query('RESET ROLE');await c.query('UPDATE private.store_memberships SET active_limit=1 WHERE owner_id=$1',[owner]);
  await as(admin);
  const snapshots=await Promise.all(owned.slice(0,2).map(async x=>(await c.query('SELECT public.get_listing_for_edit($1) v',[x.id])).rows[0].v));
  const modA=new pg.Client(config),modB=new pg.Client(config);await modA.connect();await modB.connect();
  await as(admin,'authenticated',modA);await as(admin,'authenticated',modB);
  const approvals=await Promise.allSettled([modA,modB].map((client,i)=>client.query('SELECT public.moderate_listing_snapshot($1,$2,$3)',[snapshots[i].listing.id,'approved',snapshots[i].edit_token])));
  await modA.end();await modB.end();assert.equal(approvals.filter(x=>x.status==='fulfilled').length,1);
  assert.match(approvals.find(x=>x.status==='rejected').reason.message,/LISTING_ACTIVE_LIMIT_REACHED/);
  // Expiry closes only store visibility; leaves existing listings/users/log intact.
  await c.query('RESET ROLE');await c.query("UPDATE private.store_memberships SET starts_at=now()-interval '2 months',ends_at=now()-interval '1 month' WHERE owner_id=$1",[owner]);
  await as(null,'anon');assert.equal((await data(store.id)).store,null);
  assert.equal((await c.query('SELECT count(*) FROM public.listings WHERE status=$1',['approved'])).rows[0].count,'2'); // store expired, but its approved general listing remains.
  await as(owner);assert.equal((await quota()).period,'rolling_day');
  const renewal='10000000-0000-4000-8000-000000000002';
  await rpc(c,'request',renewal,null,{plan_id:'package-2',store_name:'Renewed synthetic store'});
  await as(admin);await assert.rejects(()=>rpc(c,'approve',renewal,1,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-1'}),/MEMBERSHIP_PAYMENT_USED/);
  await rpc(c,'approve',renewal,1,{payment_confirmed:true,payment_reference:'TEST-TRANSFER-2'});
  await as(owner);assert.equal((await quota()).limit,150);assert.equal((await quota()).used,0);
  assert.equal((await data()).mine.store.id,store.id);
  await as(admin);assert.equal((await quota()).unlimited,true);for(let i=0;i<4;i++)await listing();
  await c.query('RESET ROLE');assert.deepEqual((await c.query('SELECT to_jsonb(l) v FROM public.listings l WHERE id=1')).rows[0].v,before);
  assert.deepEqual((await c.query('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) v FROM auth.users u')).rows[0].v,usersBefore);
  assert.equal((await c.query('SELECT count(*) FROM private.store_payment_log')).rows[0].count,'2');
  console.log('Membership SQL passed: preservation, public privacy, verified/manual approval, spoof denial, idempotent payment, distinct quotas, pending reservations, concurrent final-slot race, correction preservation, expiry, renewal and admin exemption. Synthetic isolated database only.');
}catch(e){console.error('Membership SQL failed:',e.code||e.name,e.message);process.exitCode=1;}
finally{if(c)await c.end();if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});await rm(dir,{recursive:true,force:true});}