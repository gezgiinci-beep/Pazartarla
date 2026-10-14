// Disposable PostgreSQL, synthetic fixtures only; no secrets or live connections.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {listingMediaPlan} from './safety/listing-media-plan.mjs';
import {LISTING_META_MARKER} from '../src/lib/listingMedia.mjs';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'listing-media-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',
  admin='00000000-0000-4000-8000-000000000003';
const uuid='00000000-0000-4000-8000-000000000004';
let running=false,c;
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',
    `-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63380`,'-w','start'],{env});running=true;
  c=new pg.Client({host:dir,port:63380,user:'safety_test',database:'postgres',ssl:false});await c.connect();
  await c.query(`CREATE ROLE anon;CREATE ROLE authenticated;
    CREATE SCHEMA auth;CREATE SCHEMA private;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_listing_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT coalesce(auth.uid()='${admin}',false) $$;
    CREATE FUNCTION public.is_verified_listing_submitter() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT auth.uid() IS NOT NULL AND coalesce(current_setting('test.verified',true),'true')='true' $$;
    CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
    INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz"]}');
    CREATE TABLE public.listings(id serial PRIMARY KEY,submitted_by uuid,title text,price numeric,category text,
      "subCategory" text,location text,description text,seller text,phone text,status text,image text,seotags text,
      mode text,created_at timestamptz DEFAULT now(),expires_at timestamptz DEFAULT now()+interval '12 months');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,storage,auth TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects,public.listings TO anon,authenticated;
    GRANT USAGE ON SEQUENCE public.listings_id_seq TO anon,authenticated;
    -- Deliberately broad legacy policies: restrictive media guards must hold.
    CREATE POLICY legacy_all ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    CREATE POLICY legacy_all ON public.listings FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);`);
  const tags='  Türkçe, mahsul  '+LISTING_META_MARKER+encodeURIComponent(JSON.stringify({
    images:['data:image/png;base64,iVBORw0KGgo=','https://example.org/gallery.jpg'],isFeatured:true}));
  await c.query(`INSERT INTO public.listings(submitted_by,title,price,category,"subCategory",location,description,
    seller,phone,status,image,seotags,mode) VALUES($1,'Synthetic',100,'Mahsuller','Ceviz','Test','KEEP',
    'Synthetic seller','+12025550100','approved','https://example.org/cover.jpg',$2,'Satılık')`,[owner,tags]);
  const original=(await c.query('SELECT to_jsonb(l) row FROM public.listings l WHERE id=1')).rows[0].row;
  for(const name of ['20261004_owner_listing_edit.sql','20261004_listing_media_expand.sql'])
    await c.query(await readFile(new URL('../supabase/reviewed_changes/'+name,import.meta.url),'utf8'));
  const expanded=(await c.query('SELECT to_jsonb(l) row FROM public.listings l WHERE id=1')).rows[0].row;
  for(const [key,value] of Object.entries(original))assert.deepEqual(expanded[key],value,key);
  assert.equal(expanded.gallery_paths,null);assert.equal(expanded.is_featured,null);
  const finalize=await readFile(new URL('../supabase/reviewed_changes/20261004_listing_media_finalize.sql',import.meta.url),'utf8');
  await assert.rejects(()=>c.query(finalize),/LISTING_MEDIA_BACKFILL_NOT_VERIFIED/);
  await c.query('ROLLBACK');
  async function as(uid,role='authenticated',verified=true){
    await c.query('RESET ROLE');
    await c.query("SELECT set_config('test.uid',$1,false),set_config('test.verified',$2,false)",[uid,String(verified)]);
    await c.query('SET ROLE '+role);
  }
  async function denied(fn,code){await assert.rejects(fn,error=>error.code===code);}
  const objectPath=owner+'/'+uuid+'.png',ref='listing-media/'+objectPath;
  await as('', 'anon');
  await denied(()=>c.query("INSERT INTO storage.objects VALUES('listing-media',$1)",[objectPath]),'42501');
  await as(owner,'authenticated',false);
  await denied(()=>c.query("INSERT INTO storage.objects VALUES('listing-media',$1)",[objectPath]),'42501');
  await as(other);
  await denied(()=>c.query("INSERT INTO storage.objects VALUES('listing-media',$1)",[objectPath]),'42501');
  await as(owner);
  await c.query("INSERT INTO storage.objects VALUES('listing-media',$1)",[objectPath]);
  assert.equal((await c.query("UPDATE storage.objects SET name='overwrite' WHERE bucket_id='listing-media' RETURNING name")).rowCount,0);
  assert.equal((await c.query("DELETE FROM storage.objects WHERE bucket_id='listing-media' RETURNING name")).rowCount,0);
  await denied(()=>c.query("INSERT INTO public.listings(title,gallery_paths,is_featured) VALUES('Smuggled',$1,true)",[[ref]]),'42501');
  await denied(()=>c.query("INSERT INTO public.listings(title,gallery_paths,is_featured) VALUES('Not owned',$1,false)",
    [['listing-media/'+other+'/'+uuid+'.png']]),'22023');
  await denied(()=>c.query("INSERT INTO public.listings(title,gallery_paths,image) VALUES('Inline',$1,'data:image/png;base64,iVBORw0KGgo=')",[[ref]]),'22023');
  await denied(()=>c.query("INSERT INTO public.listings(title,gallery_paths,seotags) VALUES('Suffix',$1,$2)",[[ref],tags]),'22023');
  await c.query("INSERT INTO public.listings(title,gallery_paths,is_featured,image,seotags) VALUES('New',$1,false,'https://example.org/new.jpg','plain SEO')",[[ref]]);
  await denied(()=>c.query('UPDATE public.listings SET is_featured=true WHERE title=$1',['New']),'42501');
  await denied(()=>c.query("SELECT public.update_listing_media(1,'{}','invalid')"),'42501');
  await as(admin);
  const get=async()=>(await c.query('SELECT public.get_listing_for_edit(1) result')).rows[0].result;
  const save=async(patch,token)=>(await c.query('SELECT public.update_listing_media(1,$1,$2) result',[JSON.stringify(patch),token])).rows[0].result;
  const snapshot=await get();
  await denied(()=>save({title:'Not a media field'},snapshot.edit_token),'22023');
  await denied(()=>save({is_featured:'true'},snapshot.edit_token),'22023');
  await denied(()=>save({gallery_paths:[null]},snapshot.edit_token),'22023');
  await denied(()=>save({gallery_paths:['data:image/png;base64,iVBORw0KGgo=']},snapshot.edit_token),'22023');
  await denied(()=>save({gallery_paths:['https://example.supabase.co/storage/v1/object/public/listing-media/'+objectPath]},snapshot.edit_token),'22023');
  const featured=await save({is_featured:false},snapshot.edit_token);
  assert.equal(featured.listing.is_featured,false);
  assert.equal(featured.listing.seotags,tags);
  await denied(()=>save({is_featured:true},snapshot.edit_token),'40001');
  // Simulate backfill after byte verification (tested separately with mocked
  // Storage download hashes); the SQL test never claims to upload real bytes.
  await as('');
  await c.query('RESET ROLE');
  const row=(await c.query('SELECT to_jsonb(l) row FROM public.listings l WHERE id=1')).rows[0].row;
  const plan=listingMediaPlan(row,'https://example.supabase.co');
  for(const path of plan.uploads.keys())await c.query("INSERT INTO storage.objects VALUES('listing-media',$1)",[path]);
  await c.query(`UPDATE public.listings SET gallery_paths=$1,is_featured=$2,image=$3,seotags=$4 WHERE id=1`,
    [plan.changes.gallery_paths,plan.changes.is_featured,plan.changes.image,plan.changes.seotags]);
  const migrated=(await c.query('SELECT to_jsonb(l) row FROM public.listings l WHERE id=1')).rows[0].row;
  for(const [key,value] of Object.entries(original))
    if(!Object.hasOwn(plan.changes,key))assert.deepEqual(migrated[key],value,key);
  assert.equal(migrated.seotags,'  Türkçe, mahsul  ');
  assert.equal(migrated.gallery_paths.length,3);
  await c.query(finalize);
  await as(admin);
  let fresh=await get();
  await denied(()=>save({image:'data:image/png;base64,iVBORw0KGgo='},fresh.edit_token),'22023');
  await denied(()=>save({seotags:tags},fresh.edit_token),'22023');
  const gallery=await save({gallery_paths:[ref],image:'https://example.org/changed.jpg',seotags:'new SEO'},fresh.edit_token);
  assert.equal(gallery.listing.title,original.title);
  assert.equal(gallery.listing.price,original.price);
  assert.equal(gallery.listing.status,original.status);
  await denied(()=>save({is_featured:true},fresh.edit_token),'40001');
  fresh=await get();
  const final=await save({is_featured:true},fresh.edit_token);
  assert.equal(final.listing.is_featured,true);
  assert.deepEqual(final.listing.gallery_paths,[ref]);
  console.log('Listing media SQL passed: expand preserves originals; public/unverified/other-user uploads denied; overwrite/delete denied despite legacy ALL; member featured injection rejected; admin snapshot/allowlist enforced; backfill preserves SEO/photos/protected fields; finalize blocks inline/suffix writes.');
}catch(error){
  console.error('Synthetic media SQL test failed:',error.code || error.name,error.message);
  process.exitCode=1;
}finally{
  if(c)await c.end();
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}