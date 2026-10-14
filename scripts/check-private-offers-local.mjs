// Only synthetic data in an isolated temporary UNIX-socket PostgreSQL instance.
// Never reads DATABASE_URL, Supabase keys, account sessions, or production data.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'private-offers-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const seller='00000000-0000-4000-8000-000000000001';
const buyer='00000000-0000-4000-8000-000000000002';
const stranger='00000000-0000-4000-8000-000000000003';
let running=false,c;
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','offer_safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63381`,'-w','start'],{env});
  running=true;
  c=new pg.Client({host:dir,port:63381,user:'offer_safety_test',database:'postgres',ssl:false});
  await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_verified_listing_submitter() RETURNS bool LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.verified',true),'true')='true' $$;
    CREATE TABLE public.listings(id serial PRIMARY KEY,submitted_by uuid,title text,price numeric,
      phone text,status text,created_at timestamptz,expires_at timestamptz,image text);
    INSERT INTO public.listings(submitted_by,title,price,phone,status,created_at,expires_at,image)
    SELECT '${seller}', 'Synthetic product '||n,150,'+12025550100',
      CASE WHEN n=3 THEN 'pending' ELSE 'approved' END,now()-interval '1 month',
      CASE WHEN n=4 THEN now()-interval '1 day' ELSE now()+interval '7 months' END,
      'https://example.invalid/unchanged-photo' FROM generate_series(1,4) n;
    INSERT INTO public.listings(submitted_by,title,price,phone,status,created_at,expires_at,image)
    VALUES('${buyer}','Buyer owned',90,'+12025550101','approved',now(),now()+interval '8 months','KEEP');
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  const original=(await c.query('SELECT jsonb_agg(to_jsonb(l) ORDER BY id) rows FROM public.listings l')).rows[0].rows;
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261005_private_listing_offers.sql',import.meta.url),'utf8'));
  assert.deepEqual((await c.query('SELECT jsonb_agg(to_jsonb(l) ORDER BY id) rows FROM public.listings l')).rows[0].rows,original);
  async function as(uid,verified=true,role='authenticated'){
    await c.query('RESET ROLE');
    await c.query("SELECT set_config('test.uid',$1,false),set_config('test.verified',$2,false)",[uid,String(verified)]);
    await c.query('SET ROLE '+role);
  }
  const rpc=async(sql,params=[]) => (await c.query(sql,params)).rows[0].result;
  const catalog=()=>rpc('SELECT public.get_offer_catalog() result');
  const data=()=>rpc('SELECT public.get_my_offer_data() result');
  const toggle=(id,on)=>rpc('SELECT public.set_listing_offer_enabled($1,$2) result',[id,on]);
  const submit=(id,amount=120,phone='+12025550111')=>rpc('SELECT public.create_listing_offer($1,$2,$3,$4,$5) result',[id,amount,'2 ton','Synthetic private note',phone]);
  const respond=(id,action,amount=null)=>rpc('SELECT public.respond_to_listing_offer($1,$2,$3) result',[id,action,amount]);
  const message=(id,body)=>rpc('SELECT public.send_listing_offer_message($1,$2) result',[id,body]);
  const denied=(fn,reason)=>assert.rejects(fn,error=>reason==='42501'?error.code==='42501':error.message===reason);

  await as('',true,'anon');
  assert.deepEqual(await catalog(),[],'Existing ordinary listings stay off by default');
  await denied(data,'42501');
  await denied(()=>c.query('SELECT * FROM private.listing_offers'),'42501');
  await denied(()=>toggle(1,true),'42501');
  await as(seller);assert.equal((await toggle(1,true)).enabled,true);
  assert.deepEqual(await catalog(),[1],'Only that product opts in, not the store');
  assert.deepEqual((await data()).owner_ids,[1,2,3,4]);
  await denied(()=>toggle(4,true),'OFFER_NOT_AVAILABLE');
  await toggle(3,true);
  assert.deepEqual(await catalog(),[1],'Pending offer listings remain moderated');
  await as(buyer);
  await denied(()=>toggle(1,false),'OFFER_NOT_OWNER');
  await denied(()=>submit(2),'OFFER_NOT_AVAILABLE');
  await denied(()=>submit(3),'OFFER_NOT_AVAILABLE');
  await toggle(5,true);
  await denied(()=>submit(5),'OFFER_NOT_AVAILABLE');
  await denied(()=>submit(1,-1),'OFFER_INVALID');
  await denied(()=>submit(1,120,'not a phone'),'OFFER_INVALID');
  await as(buyer,false);await denied(()=>submit(1),'42501');
  await as(buyer);
  const offer=(await submit(1)).id;
  let own=await data();
  assert.equal(own.offers[0].role,'buyer');
  assert.equal(own.offers[0].amount,120);
  assert.equal(own.offers[0].buyer_phone,null);
  assert.equal(own.offers[0].seller_phone,null);
  await denied(()=>submit(1),'OFFER_CONFLICT');
  await denied(()=>respond(offer,'accept'),'OFFER_CONFLICT');
  await denied(()=>message(offer,'Before agreement'),'42501');
  await as(stranger);
  assert.deepEqual((await data()).offers,[],'No other buyer sees bids or identities');
  assert.deepEqual((await data()).messages,[]);
  await denied(()=>respond(offer,'counter',140),'OFFER_CONFLICT');
  await denied(()=>c.query('UPDATE private.listing_offers SET amount=1'),'42501');
  await as(seller);
  own=await data();assert.equal(own.offers[0].role,'seller');assert.equal(own.offers[0].buyer_phone,null);
  assert.equal((await respond(offer,'counter',135)).status,'countered');
  await denied(()=>respond(offer,'accept'),'OFFER_CONFLICT');
  await as(buyer);assert.equal((await respond(offer,'buyer_accept')).status,'accepted');
  own=await data();
  assert.equal(own.offers[0].counter_amount,135);
  assert.equal(own.offers[0].buyer_phone,'+12025550111');
  assert.equal(own.offers[0].seller_phone,'+12025550100');
  await message(offer,'Buyer message');
  await as(seller);await message(offer,'Seller reply');
  assert.equal((await data()).messages.length,2);
  await as(stranger);assert.deepEqual((await data()).messages,[]);
  await denied(()=>message(offer,'Intrusion'),'42501');
  const declined=(await submit(1)).id;
  await as(seller);assert.equal((await respond(declined,'decline')).status,'declined');
  await denied(()=>message(declined,'Declined conversation'),'42501');
  await as(buyer);const retained=(await submit(1)).id;
  await as(seller);await toggle(1,false);
  assert(!((await catalog()).includes(1)));
  assert.equal((await respond(retained,'accept')).status,'accepted','Disabling blocks new bids, not existing negotiations');
  await as(buyer);await denied(()=>submit(1),'OFFER_NOT_AVAILABLE');
  await message(offer,'Agreement survives offer switch being disabled');
  await as(seller);await toggle(2,true);
  await as(buyer);const paused=(await submit(2)).id;
  await c.query('RESET ROLE');await c.query("UPDATE public.listings SET status='pending' WHERE id=2");
  await as(seller);
  await denied(()=>respond(paused,'accept'),'OFFER_NOT_AVAILABLE');
  assert.equal((await respond(paused,'decline')).status,'declined');
  await c.query('RESET ROLE');
  await c.query("UPDATE public.listings SET status='approved' WHERE id=2");
  await as(buyer);
  for(let n=0;n<7;n++){
    const id=(await submit(2)).id;await as(seller);await respond(id,'decline');await as(buyer);
  }
  await denied(()=>submit(2),'OFFER_LIMIT');
  for(let n=0;n<48;n++)await message(offer,'Synthetic quota message '+n);
  await denied(()=>message(offer,'Over daily message quota'),'OFFER_MESSAGE_LIMIT');
  await c.query('RESET ROLE');
  const final=(await c.query('SELECT jsonb_agg(to_jsonb(l) ORDER BY id) rows FROM public.listings l')).rows[0].rows;
  assert.deepEqual(final,original,'Offer operations preserve listing records and media');
  console.log('PASS: opt-in defaults, per-product ownership, moderation, private bids, verified auth, counteroffer acceptance, private messages, contact release, disable semantics, RLS and daily quotas; only synthetic temporary data.');
}finally{
  if(c)await c.end().catch(()=>{});
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','immediate','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}
