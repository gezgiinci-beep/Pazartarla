// Real permissions tests in disposable PostgreSQL, never a live connection.
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import pg from 'pg';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'sponsor-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
let running=false,c;
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--encoding=UTF8','--no-locale'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63378`,'-w','start'],{env});running=true;
  c=new pg.Client({host:dir,port:63378,user:'safety_test',password:'synthetic-local-only',database:'postgres',ssl:false});await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-4000-8000-000000000009'::uuid $$;
    CREATE FUNCTION public.is_listing_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE TABLE public.listings(id integer,title text);INSERT INTO public.listings VALUES(77,'Synthetic listing remains untouched');`);
  await c.query(await readFile(new URL('../supabase/migrations/20261004_advertisements.sql',import.meta.url),'utf8'));
  const id='00000000-0000-4000-8000-000000000001';
  await c.query(`INSERT INTO public.advertisements(id,title,is_active,media_path,media_type)
    VALUES($1,'Synthetic sponsor',true,$2,'image')`,[id,id+'/00000000-0000-4000-8000-000000000002.png']);
  const before=(await c.query('SELECT to_jsonb(a) r FROM public.advertisements a')).rows[0].r;
  await c.query("SELECT set_config('test.admin','true',false);SET ROLE authenticated");
  await assert.rejects(()=>c.query("UPDATE public.advertisements SET media_type='image'"),e=>e.code==='42501');
  await c.query('RESET ROLE');
  await c.query(await readFile(new URL('../supabase/reviewed_changes/20261004_sponsor_media_replace.sql',import.meta.url),'utf8'));
  assert.deepEqual((await c.query('SELECT to_jsonb(a) r FROM public.advertisements a')).rows[0].r,before);
  await c.query("SELECT set_config('test.admin','false',false);SET ROLE authenticated");
  assert.equal((await c.query("UPDATE public.advertisements SET media_type='image' RETURNING id")).rowCount,0);
  await c.query("RESET ROLE;SET ROLE anon");
  await assert.rejects(()=>c.query("UPDATE public.advertisements SET media_type='image'"),e=>e.code==='42501');
  await c.query("RESET ROLE;SELECT set_config('test.admin','true',false);SET ROLE authenticated");
  const updated=(await c.query(`UPDATE public.advertisements SET media_path=$1,media_type='image'
    WHERE id=$2 AND revision=1 RETURNING *`,[id+'/00000000-0000-4000-8000-000000000003.webp',id])).rows[0];
  assert.equal(updated.id,id);assert.equal(updated.revision,2);assert.equal(updated.title,before.title);
  assert.equal(updated.created_at.toISOString(),new Date(before.created_at).toISOString());
  assert.equal((await c.query("UPDATE public.advertisements SET title='Stale' WHERE revision=1 RETURNING id")).rowCount,0);
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT title FROM public.listings')).rows[0].title,'Synthetic listing remains untouched');
  console.log('Sponsor SQL passed: unchanged installation, admin-only media replacement, anon/member denial, revision conflict and untouched listings. Synthetic local database only.');
}catch(e){console.error('Sponsor SQL test failed:',e.code||e.name,e.message);process.exitCode=1;}
finally{if(c)await c.end();if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});await rm(dir,{recursive:true,force:true});}