import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabaseConfig,assertTestEnvironment} from './safety/database-target.mjs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const client=new pg.Client(testDatabaseConfig());
let phase='schema';
try {
  await client.connect();await assertTestEnvironment(client);await client.query('BEGIN');
  const sql=readFileSync(new URL('../supabase/migrations/20261004_contact_bulk_import.sql',import.meta.url),'utf8');
  await client.query(sql.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,''));
  const admin=(await client.query(`SELECT u.id,lower(u.email) email FROM auth.users u JOIN private.listing_admins a ON a.email=lower(u.email) WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];
  assert.ok(admin);
  async function role(name,claims){await client.query('RESET ROLE');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await client.query('SET LOCAL ROLE '+name);}
  const asAdmin=()=>role('authenticated',{role:'authenticated',sub:admin.id,email:admin.email});
  async function rejected(sql,params=[],expected='42501'){
    await client.query('SAVEPOINT reject');let code;
    try{await client.query(sql,params);}catch(e){code=e.code;}
    await client.query('ROLLBACK TO SAVEPOINT reject');assert.equal(code,expected);
  }
  phase='access';
  for(const name of ['anon','authenticated']){
    await role(name,{role:name,sub:randomUUID(),email:'not-admin@example.invalid'});
    await rejected("SELECT public.preview_depot_import('[]')");
    await rejected("SELECT public.import_depot_contacts('[]',$1)",[randomUUID()+':0']);
    await rejected('SELECT * FROM private.depot_import_receipts');
    await rejected("SELECT private.depot_process_import('[]',true)");
  }
  await asAdmin();
  const tag=randomUUID(),mail=tag+'@example.invalid',mail2='second-'+tag+'@example.invalid';
  const existing=(await client.query("SELECT public.save_depot_contact(NULL,NULL,'original',$1,'+12025550130') id",[mail])).rows[0].id;
  await client.query('RESET ROLE');
  await client.query('UPDATE private.depot_contacts SET archived=true WHERE id=$1',[existing]);
  await asAdmin();
  const rows=[
    {row:2,name:'New Fullname',email:mail2,phone:'+12025550131'},
    {row:3,name:'Must not overwrite',email:mail,phone:'+12025550132'},
    {row:4,name:'Shared phone',email:'other-'+tag+'@example.invalid',phone:'+12025550130'},
    {row:5,name:'Bad email',email:'bad',phone:'+12025550133'},
    {row:6,name:'Bad phone',email:'badphone-'+tag+'@example.invalid',phone:'invalid'},
    {row:7,name:'Duplicate file',email:mail2.toUpperCase(),phone:'+12025550134'},
  ];
  async function run(name,rows,id){return(await client.query('SELECT public.'+name+'($1::jsonb'+(id?',$2':'')+') report',[JSON.stringify(rows),...(id?[id]:[])])).rows[0].report;}
  phase='preview';
  const preview=await run('preview_depot_import',rows);
  assert.deepEqual(preview.map(r=>r.status),['ready','duplicate','duplicate','invalid','invalid','duplicate']);
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_contacts WHERE email=$1',[mail2])).rows[0].n,0);
  await asAdmin();phase='import and replay';
  const id=randomUUID()+':0',saved=await run('import_depot_contacts',rows,id);
  assert.deepEqual(saved.map(r=>r.status),['imported','duplicate','duplicate','invalid','invalid','duplicate']);
  assert.deepEqual(await run('import_depot_contacts',rows,id),saved);
  await rejected('SELECT public.import_depot_contacts($1::jsonb,$2)',[JSON.stringify([{...rows[0],name:'changed'}]),id],'40001');
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_contacts WHERE email=$1',[mail2])).rows[0].n,1);
  assert.equal((await client.query('SELECT name FROM private.depot_contacts WHERE id=$1',[existing])).rows[0].name,'original');
  assert.ok((await client.query(`SELECT p.status FROM private.depot_permissions p JOIN private.depot_contacts c ON c.id=p.contact_id WHERE c.email=$1`,[mail2])).rows.every(p=>p.status==='unknown'));
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_import_receipts WHERE request_id=$1',[id])).rows[0].n,1);
  phase='race and bounds';await asAdmin();
  const race={row:8,name:'Race row',email:'race-'+tag+'@example.invalid',phone:'+12025550135'};
  assert.equal((await run('preview_depot_import',[race]))[0].status,'ready');
  await client.query("SELECT public.save_depot_contact(NULL,NULL,'Added between preview/save',$1,$2)",[race.email,race.phone]);
  assert.equal((await run('import_depot_contacts',[race],randomUUID()+':0'))[0].status,'duplicate');
  await rejected("SELECT public.preview_depot_import('[]')",[],'22023');
  await rejected("SELECT public.preview_depot_import($1::jsonb)",[JSON.stringify(Array.from({length:201},()=>race))],'22023');
  await rejected("SELECT public.import_depot_contacts($1::jsonb,$2)",[JSON.stringify([race]),'bad-id'],'22023');
  await rejected("SELECT public.preview_depot_import($1::jsonb)",[JSON.stringify([{...race,row:null}])],'22023');
  phase='batch rollback';
  const atomicEmail='atomic-'+tag+'@example.invalid';
  await rejected("SELECT public.import_depot_contacts($1::jsonb,$2)",[JSON.stringify([{...race,email:atomicEmail,phone:'+12025550136'},{row:null}]),randomUUID()+':0'],'22023');
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_contacts WHERE email=$1',[atomicEmail])).rows[0].n,0);
  phase='original listing capture';
  await asAdmin();
  const listing=(await client.query(`INSERT INTO public.listings(title,price,category,seller,phone,status)
    VALUES('Import rollback fixture',1,'Test','Test','+12025550137','pending') RETURNING id`)).rows[0].id;
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_sources WHERE listing_id=$1',[listing])).rows[0].n,1);
  await client.query('ROLLBACK');
  console.log('Import DB checks passed: admin-only access, non-writing preview, email OR phone duplicates including archive, no overwrite, unknown permissions, safe replay, conflicts/races, batch bounds/rollback and existing listing capture. All fixtures rolled back.');
}catch(e){console.error('Import DB check failed:',phase,e.code||e.name);
  if(e.code==='42601')console.error(e.message,e.position||e.internalPosition);
  if(e.name==='AssertionError')console.error('Assertion line:',e.stack.split('\n').find(l=>l.includes('check-contact-import-database')));
  process.exitCode=1;
}finally{await client.query('ROLLBACK').catch(()=>{});await client.end();}