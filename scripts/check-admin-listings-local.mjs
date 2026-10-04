// Never connects to Supabase or reads its secrets. Exercises real PostgreSQL
// grants, RLS and RPCs using only synthetic data on a private temporary socket.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';

const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'listing-admin-test-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
const config={host:dir,port:63380,user:'safety_test',database:'postgres',ssl:false};
const ids={member:'00000000-0000-4000-8000-000000000001',
  admin:'00000000-0000-4000-8000-000000000002',
  unverified:'00000000-0000-4000-8000-000000000003',
  anonymous:'00000000-0000-4000-8000-000000000004',
  banned:'00000000-0000-4000-8000-000000000005'};
let c,running=false;
const meta=(featured=false)=>'SEO\\n__PAZARTARLA_META_V1__:'+encodeURIComponent(JSON.stringify({
  images:['https://example.invalid/photo'],isFeatured:featured
}));
async function apply(path){await c.query(await readFile(new URL('../supabase/'+path,import.meta.url),'utf8'));}
async function as(user,role='authenticated',client=c,extra={}){
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({
    role,sub:user||undefined,email:user===ids.admin?'admin@example.invalid':'member@example.invalid',...extra
  })]);
  await client.query('SET ROLE '+role);
}
async function insert(featured=false,client=c,status='pending'){
  return (await client.query(`INSERT INTO public.listings(title,price,category,"subCategory",seller,phone,status,seotags,submitted_by,created_at)
    VALUES('Synthetic listing',150,'Mahsuller','Ceviz','Synthetic seller','+12025550100',$1,$2,$3,'2000-01-01')
    RETURNING *`,[status,meta(featured),ids.admin])).rows[0];
}
async function denied(fn,code='42501'){await assert.rejects(fn,e=>e.code===code);}
async function get(id){return(await c.query('SELECT public.get_listing_for_edit($1) r',[id])).rows[0].r;}
try{
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',
    `-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63380`,'-w','start'],{env});
  running=true;c=new pg.Client(config);await c.connect();
  await c.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,banned_until timestamptz);
    CREATE TABLE public.listings(id serial PRIMARY KEY,title text,price numeric,category text,"subCategory" text,
      location text,description text,seller text,phone text,status text,image text,seotags text,mode text,
      created_at timestamptz DEFAULT now(),expires_at timestamptz DEFAULT now()+interval '8 months');
    CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
    INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz"]}');
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    -- Simulate an unknown legacy policy that would OR-bypass permissive guards.
    CREATE POLICY legacy_public_all ON public.listings FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    GRANT ALL ON public.listings TO anon,authenticated;`);
  for(const [kind,id] of Object.entries(ids)){
    await c.query('INSERT INTO auth.users VALUES($1,$2,$3,$4,$5)',
      [id,kind==='member'?'member@example.invalid':'admin@example.invalid',
        kind==='unverified'?null:new Date(),kind==='anonymous',kind==='banned'?new Date('2099-01-01'):null]);
  }
  await apply('migrations/20261003_secure_listing_admin.sql');
  await c.query("INSERT INTO private.listing_admins(email) VALUES('admin@example.invalid')");
  await apply('migrations/20261004_moderated_submissions.sql');
  await apply('migrations/20261004_unlimited_admin_submissions.sql');
  await apply('reviewed_changes/20261004_owner_listing_edit.sql');
  await apply('reviewed_changes/20261004_listing_admin_hardening.sql');
  await as('', 'anon');
  assert.equal((await c.query('SELECT public.is_listing_admin() allowed')).rows[0].allowed,false);
  await denied(()=>insert());
  for(const user of [ids.unverified,ids.anonymous,ids.banned]){
    await as(user);
    assert.equal((await c.query('SELECT public.is_listing_admin() allowed')).rows[0].allowed,false);
    await denied(()=>c.query('SELECT public.get_listing_moderation_queue()'));
  }
  await as(ids.unverified);await denied(()=>insert());
  await as(ids.member,'authenticated',c,{email:'admin@example.invalid',user_metadata:{is_admin:true}});
  assert.equal((await c.query('SELECT public.is_listing_admin() allowed')).rows[0].allowed,false);
  await denied(()=>insert(false,c,'approved'));
  await denied(()=>insert(true));
  for(const tags of [
    meta(false)+'\\n__PAZARTARLA_META_V1__:'+encodeURIComponent('{"isFeatured":true}'),
    'SEO\\n__PAZARTARLA_META_V1__:'+encodeURIComponent('{"isFeatured":true,"images":["ç"]}'),
    'SEO\\n__PAZARTARLA_META_V1__:'+'%7b%22isFeatured%22%3atrue%7d'
  ]){
    await denied(()=>c.query("INSERT INTO public.listings(status,seotags) VALUES('pending',$1)",[tags]));
  }
  for(const value of ['%ZZ','%F0','[]','null','not-json']){
    await denied(()=>c.query("INSERT INTO public.listings(status,seotags) VALUES('pending',$1)",
      ['SEO\\n__PAZARTARLA_META_V1__:'+value]),'22023');
  }
  const row=await insert();
  assert.equal(row.status,'pending');
  assert.equal(row.submitted_by,ids.member);
  assert.equal(row.seotags,meta(false),'Gallery and SEO preserved');
  assert.ok(new Date(row.created_at).getFullYear()>2000,'Timestamp spoof overwritten');
  // Even with an unknown permissive ALL policy, non-admin writes remain denied.
  assert.equal((await c.query("UPDATE public.listings SET status='approved',seotags=$1 WHERE id=$2 RETURNING id",[meta(true),row.id])).rowCount,0);
  assert.equal((await c.query('DELETE FROM public.listings WHERE id=$1 RETURNING id',[row.id])).rowCount,0);
  await denied(()=>c.query('SELECT * FROM private.listing_admins'));
  const ownerSnapshot=await get(row.id);
  await denied(()=>c.query('SELECT public.update_listing_media($1,$2,$3)',[row.id,JSON.stringify({seotags:meta(true)}),ownerSnapshot.edit_token]));
  await denied(()=>c.query("SELECT public.moderate_listing_snapshot($1,'approved',$2)",[row.id,ownerSnapshot.edit_token]));
  await as('','anon');
  assert.equal((await c.query('SELECT id FROM public.listings')).rowCount,0,'Pending hidden from visitors');
  await denied(()=>c.query("UPDATE public.listings SET status='approved' WHERE id=$1",[row.id]));
  await denied(()=>c.query('DELETE FROM public.listings WHERE id=$1',[row.id]));
  await denied(()=>c.query('SELECT public.update_listing_media($1,$2,$3)',[row.id,'{}',ownerSnapshot.edit_token]));

  await as(ids.member);
  await insert();
  // Concurrent sessions cannot both consume the last slot.
  const contenders=await Promise.all([0,1].map(async()=>{
    const other=new pg.Client(config);await other.connect();
    try{await as(ids.member,'authenticated',other);return await insert(false,other);}
    catch(e){return {error:e.message};}finally{await other.end();}
  }));
  assert.equal(contenders.filter(x=>x.id).length,1);
  assert.equal(contenders.filter(x=>x.error==='LISTING_DAILY_LIMIT_REACHED').length,1);
  await denied(()=>insert(),'P0001');

  await as(ids.admin);
  assert.equal((await c.query('SELECT public.is_listing_admin() allowed')).rows[0].allowed,true);
  const pending=await get(row.id);
  await c.query("SELECT public.moderate_listing_snapshot($1,'approved',$2)",[row.id,pending.edit_token]);
  let snapshot=await get(row.id);
  await c.query('SELECT public.update_listing_details($1,$2,$3)',
    [row.id,JSON.stringify({title:'Admin correction',price:175}),snapshot.edit_token]);
  snapshot=await get(row.id);
  await c.query('SELECT public.update_listing_media($1,$2,$3)',
    [row.id,JSON.stringify({seotags:meta(true)}),snapshot.edit_token]);
  const deleteTarget=await insert();
  assert.equal((await c.query('DELETE FROM public.listings WHERE id=$1 RETURNING id',[deleteTarget.id])).rowCount,1);
  assert.equal((await insert(true)).seotags,meta(true),'Administrators may set featured metadata');
  for(let i=0;i<4;i++)await insert();
  assert.equal((await c.query('SELECT public.get_listing_submission_quota() q')).rows[0].q.unlimited,true);
  // Commit/autocommit, close and reopen: not just in-memory UI or one transaction.
  await c.end();c=new pg.Client(config);await c.connect();await as(ids.admin);
  snapshot=await get(row.id);
  assert.equal(snapshot.listing.title,'Admin correction');
  assert.equal(Number(snapshot.listing.price),175);
  assert.equal(snapshot.listing.status,'approved');
  assert.equal(snapshot.listing.seotags,meta(true));
  assert.equal((await c.query('SELECT id FROM public.listings WHERE id=$1',[deleteTarget.id])).rowCount,0);
  // Rejection/deletion never refunds the member's submission quota.
  await c.query("UPDATE public.listings SET status='rejected' WHERE submitted_by=$1 AND id<>$2",[ids.member,row.id]);
  await c.query('DELETE FROM public.listings WHERE submitted_by=$1 AND id<>$2',[ids.member,row.id]);
  await as(ids.member);await denied(()=>insert(),'P0001');
  await as('','anon');
  assert.equal((await c.query('SELECT id FROM public.listings')).rowCount,1,'Only approved row is public');
  // A removed allowlist entry revokes an already-issued session.
  await c.query('RESET ROLE');
  await c.query("DELETE FROM private.listing_admins WHERE email='admin@example.invalid'");
  await as(ids.admin);
  assert.equal((await c.query('SELECT public.is_listing_admin() allowed')).rows[0].allowed,false);
  assert.equal((await c.query('DELETE FROM public.listings WHERE id=$1 RETURNING id',[row.id])).rowCount,0);
  console.log('Admin SQL passed: anonymous/member denials under legacy ALL policy, verified private allowlist, featuring guard, moderation, concurrent 3/day quota, unlimited admin, persisted edit/feature/delete after reconnection and immediate revocation. No live data touched.');
}catch(e){console.error('Admin SQL test failed:',e.code||e.name,e.message);process.exitCode=1;}
finally{
  if(c)await c.end().catch(()=>{});
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}