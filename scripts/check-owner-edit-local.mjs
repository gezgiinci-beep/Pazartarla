// Real SQL with synthetic fixtures in an isolated, disposable UNIX-socket PG.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'owner-edit-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
let running=false,c;
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003';
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63379`,'-w','start'],{env});running=true;
  c=new pg.Client({host:dir,port:63379,user:'safety_test',database:'postgres',ssl:false});await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_listing_admin() RETURNS bool LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.uid()='${admin}',false) $$;
    CREATE FUNCTION public.is_verified_listing_submitter() RETURNS bool LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.verified',true),'true')='true' $$;
    CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
    INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz","Buğday"],"Makineler":["Traktör"]}');
    CREATE TABLE public.listings(id serial PRIMARY KEY,submitted_by uuid,title text,price numeric,category text,"subCategory" text,
      location text,description text,seller text,phone text,status text,image text,seotags text,mode text,created_at timestamptz,
      expires_at timestamptz);
    INSERT INTO public.listings(submitted_by,title,price,category,"subCategory",location,description,seller,phone,status,image,seotags,mode,created_at,expires_at)
    VALUES('${owner}','Synthetic original',150,'Mahsuller','Ceviz','Test','Description','Synthetic seller','+12025550100',
      'approved','https://example.invalid/photo','KEEP-GALLERY-AND-FEATURED','Satılık',now()-interval '1 month',now()+interval '7 months');
    ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT,UPDATE,DELETE ON public.listings TO authenticated;
    CREATE POLICY admin_only_update ON public.listings FOR UPDATE TO authenticated USING(public.is_listing_admin()) WITH CHECK(public.is_listing_admin());
    CREATE POLICY visible ON public.listings FOR SELECT TO authenticated USING(status='approved' OR submitted_by=auth.uid() OR public.is_listing_admin());`);
  const before=(await c.query('SELECT to_jsonb(l) row FROM public.listings l')).rows[0].row;
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261004_owner_listing_edit.sql',import.meta.url),'utf8'));
  assert.deepEqual((await c.query('SELECT to_jsonb(l) row FROM public.listings l')).rows[0].row,before,'Installing functions must not alter a row');
  async function as(uid,verified=true,role='authenticated'){
    await c.query('RESET ROLE');await c.query("SELECT set_config('test.uid',$1,false),set_config('test.verified',$2,false)",[uid,String(verified)]);await c.query('SET ROLE '+role);
  }
  async function get(){return(await c.query('SELECT public.get_listing_for_edit(1) result')).rows[0].result;}
  async function update(patch,token){return(await c.query('SELECT public.update_listing_details(1,$1::jsonb,$2) result',[JSON.stringify(patch),token])).rows[0].result;}
  async function denied(fn,code){await assert.rejects(fn,e=>e.code===code);}
  await as(owner);let original=await get();
  let unchanged=await update({},original.edit_token);assert.equal(unchanged.changed,false);assert.equal(unchanged.listing.status,'approved');
  const edited=await update({price:175,title:'Corrected title'},original.edit_token);
  assert.equal(edited.listing.id,1);assert.equal(edited.listing.status,'pending');assert.equal(edited.reapproval_required,true);
  for(const key of ['submitted_by','created_at','expires_at','image','seotags','mode','seller','phone'])
    assert.deepEqual(edited.listing[key],before[key],key+' must be preserved');
  await denied(()=>update({price:200},original.edit_token),'40001');
  original=await get();
  for(const field of ['id','submitted_by','status','created_at','expires_at','image','seotags','mode'])
    await denied(()=>update({[field]:'FORBIDDEN'},original.edit_token),'22023');
  await denied(()=>update({price:-1},original.edit_token),'22023');
  await denied(()=>update({category:'Invented',subCategory:'Invented'},original.edit_token),'22023');
  assert.equal((await c.query("UPDATE public.listings SET status='approved' WHERE id=1 RETURNING id")).rowCount,0);
  await as(other);await denied(get,'42501');await denied(()=>update({title:'Hijack'},original.edit_token),'42501');
  await as(owner,false);await denied(get,'42501');
  await as('',true,'anon');await denied(get,'42501');
  await as(admin);original=await get();const reviewed=await update({category:'Makineler',subCategory:'Traktör'},original.edit_token);
  assert.equal(reviewed.listing.status,'pending');assert.equal(reviewed.reapproval_required,false);
  await c.query("UPDATE public.listings SET status='approved' WHERE id=1");
  original=await get();assert.equal((await update({description:'Admin correction'},original.edit_token)).listing.status,'approved');
  await c.query('RESET ROLE');await c.query("UPDATE public.listings SET expires_at=now()-interval '1 day'");
  await as(owner);await denied(get,'42501');
  await as(admin);await get();
  console.log('Owner edit SQL passed: owner/admin only, anon/other/unverified denial, reapproval, no-op, token conflicts, protected ID/owner/dates/media, category validation and archive rules. No live connection.');
}catch(e){console.error('Owner edit test failed:',e.code||e.name,e.message);process.exitCode=1;}
finally{
  if(c)await c.end();
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}