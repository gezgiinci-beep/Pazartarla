// Disposable local PostgreSQL only. No live credentials or real fixture data.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'featured-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const admin='00000000-0000-4000-8000-000000000001';
const member='00000000-0000-4000-8000-000000000002';
let running=false,c;
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',
    `-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63381`,'-w','start'],{env});
  running=true;
  c=new pg.Client({host:dir,port:63381,user:'safety_test',database:'postgres',ssl:false});
  await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,
      deleted_at timestamptz,banned_until timestamptz);
    CREATE TABLE private.listing_admins(email text PRIMARY KEY);
    INSERT INTO auth.users VALUES('${admin}','admin@example.invalid',now(),NULL,NULL),
      ('${member}','member@example.invalid',now(),NULL,NULL);
    INSERT INTO private.listing_admins VALUES('admin@example.invalid');
    CREATE TABLE public.listings(id integer PRIMARY KEY,title text,status text,seotags text,image text);
    INSERT INTO public.listings VALUES(1,'KEEP TITLE','approved','KEEP SEO AND INLINE GALLERY','KEEP IMAGE');
    GRANT USAGE ON SCHEMA public TO anon,authenticated;
    GRANT ALL ON public.listings TO anon,authenticated;`);
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261005_featured_only.sql',import.meta.url),'utf8'));
  const original=(await c.query('SELECT * FROM public.listings WHERE id=1')).rows[0];
  const as=async(role,uid)=>{
    await c.query('RESET ROLE');
    await c.query("SELECT set_config('test.uid',$1,false)",[uid]);
    await c.query(`SET ROLE ${role}`);
  };
  const denied=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);};
  const snapshot=async()=>(await c.query('SELECT public.get_listing_featured_snapshot(1) AS result')).rows[0].result;
  const save=async(value,token)=>(await c.query('SELECT public.set_listing_featured(1,$1,$2) AS result',[value,token])).rows[0].result.listing;
  await as('anon','');
  await denied(()=>snapshot(),'42501');
  await denied(()=>c.query('UPDATE public.listings SET is_featured=true WHERE id=1'),'42501');
  await as('authenticated',member);
  await denied(()=>snapshot(),'42501');
  await denied(()=>save(true,'a'.repeat(64)),'42501');
  await denied(()=>c.query('UPDATE public.listings SET is_featured=false WHERE id=1'),'42501');
  await denied(()=>c.query("INSERT INTO public.listings(id,is_featured) VALUES(2,true)"),'42501');
  await as('authenticated',admin);
  let s=await snapshot();
  const featured=await save(true,s.edit_token);
  assert.equal(featured.is_featured,true);
  await denied(()=>save(false,s.edit_token),'40001');
  s=await snapshot();
  await denied(()=>save(null,s.edit_token),'22023');
  const removed=await save(false,s.edit_token);
  assert.equal(removed.is_featured,false);
  const {is_featured:_,...kept}=removed;
  const {is_featured:__,...before}=original;
  assert.deepEqual(kept,before);
  // Authorization uses the current verified Auth record, not a stale JWT email.
  await c.query('RESET ROLE');
  await c.query("UPDATE auth.users SET email='changed@example.invalid' WHERE id=$1",[admin]);
  await as('authenticated',admin);
  await denied(()=>snapshot(),'42501');
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT count(*)::int AS count FROM public.listings')).rows[0].count,1);
  console.log('Featured SQL checks passed: admin add/remove, anonymous/member denial, stale snapshot denial, current account eligibility, exact non-featured field preservation. Synthetic local database only.');
}finally{
  if(c)await c.end().catch(()=>{});
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','immediate','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}
