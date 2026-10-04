import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabaseConfig,assertTestEnvironment} from './safety/database-target.mjs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const client=new pg.Client(testDatabaseConfig());
let phase='schema';
try {
  await client.connect();await assertTestEnvironment(client);await client.query('BEGIN');
  const sql=readFileSync(new URL('../supabase/migrations/20261004_contact_depot.sql',import.meta.url),'utf8');
  await client.query(sql.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,''));
  const admin=(await client.query(`SELECT u.id,lower(u.email) email FROM auth.users u JOIN private.listing_admins a
    ON a.email=lower(u.email) WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];assert.ok(admin);
  async function role(name,claims) {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
    await client.query('SET LOCAL ROLE '+name);
  }
  const adminRole=()=>role('authenticated',{role:'authenticated',sub:admin.id,email:admin.email});
  async function denied(sql,params=[],expected='42501') {
    await client.query('SAVEPOINT reject');let code;
    try{await client.query(sql,params);}catch(e){code=e.code;}
    await client.query('ROLLBACK TO SAVEPOINT reject');assert.equal(code,expected);
  }
  phase='access';
  for(const r of ['anon','authenticated']) {
    await role(r,{role:r,sub:randomUUID(),email:'not-an-admin@example.invalid'});
    for(const table of ['depot_contacts','depot_permissions','depot_channels','depot_deliveries','depot_permission_events','depot_optout_links','depot_sources','depot_suppressions'])
      await denied('SELECT * FROM private.'+table);
    await denied('SELECT public.get_contact_depot()');
    await denied("SELECT public.save_depot_contact(NULL,NULL,'test','t@example.invalid',NULL)");
    await denied('SELECT public.claim_depot_deliveries(25)');
  }
  phase='manual';
  await adminRole();
  const email='depot-check-'+randomUUID()+'@example.invalid';
  const cid=(await client.query("SELECT public.save_depot_contact(NULL,NULL,'CRM test',$1,'+12025550123') id",[email])).rows[0].id;
  let page=(await client.query('SELECT public.get_contact_depot($1,0,false) page',[email])).rows[0].page;
  assert.equal(page.contacts.length,1);
  assert.equal(page.contacts[0].phone,'+12025550123');
  assert.ok(Object.values(page.contacts[0].permissions).every(p=>p.status==='unknown'));
  assert.ok(page.channels.every(ch=>ch.enabled===false));
  assert.equal(JSON.stringify(page).includes('unsubscribe_token'),false);
  await denied("SELECT public.save_depot_contact(NULL,NULL,'duplicate',$1,'+12025550123')",[email],'23505');
  await denied("SELECT public.save_depot_contact(NULL,NULL,'bad','bad','abc')",[],'22023');
  await denied("SELECT public.queue_depot_campaign('none','sms','','hello',now()+interval '1 hour')",[],'22023');
  await denied("SELECT public.set_depot_permission($1,1,'sms',true,'')",[cid],'22023');
  await client.query("SELECT public.set_depot_permission($1,1,'sms',true,'test proof')",[cid]);
  await denied("SELECT public.set_depot_permission($1,1,'email',true,'test proof')",[cid],'40001');
  await client.query("SELECT public.set_depot_permission($1,2,'email',true,'test proof')",[cid]);
  const campaign=(await client.query("SELECT public.queue_depot_campaign('test','sms','','hello',now()+interval '1 hour') id")).rows[0].id;
  page=(await client.query('SELECT public.get_contact_depot($1,0,false) page',[email])).rows[0].page;
  assert.equal(page.campaigns.find(c=>c.id===campaign).status,'blocked_provider');
  await role('service_role',{role:'service_role'});
  assert.deepEqual((await client.query('SELECT public.claim_depot_deliveries(25) result')).rows[0].result,[]);
  phase='duplicate destination and unsubscribe';
  await adminRole();
  const email2='second-'+randomUUID()+'@example.invalid';
  const cid2=(await client.query("SELECT public.save_depot_contact(NULL,NULL,'CRM second',$1,'+12025550123') id",[email2])).rows[0].id;
  await client.query("SELECT public.set_depot_permission($1,1,'sms',true,'test proof')",[cid2]);
  const dedup=(await client.query("SELECT public.queue_depot_campaign('dedup','sms','','hello',now()+interval '1 hour') id")).rows[0].id;
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_deliveries WHERE campaign_id=$1',[dedup])).rows[0].n,1);
  const token=(await client.query("SELECT unsubscribe_token FROM private.depot_permissions WHERE contact_id=$1 AND channel='sms'",[cid])).rows[0].unsubscribe_token;
  await role('anon',{role:'anon'});
  assert.equal((await client.query('SELECT public.unsubscribe_depot_contact($1) ok',[token])).rows[0].ok,true);
  await client.query('RESET ROLE');
  assert.equal((await client.query("SELECT count(*)::int n FROM private.depot_permissions WHERE contact_id=ANY($1::uuid[]) AND channel='sms' AND status='granted'",[[cid,cid2]])).rows[0].n,0);
  assert.equal((await client.query("SELECT count(*)::int n FROM private.depot_deliveries WHERE campaign_id=$1 AND status='queued'",[dedup])).rows[0].n,0);
  phase='edit/archive';
  await adminRole();
  page=(await client.query('SELECT public.get_contact_depot($1,0,false) page',[email])).rows[0].page;
  const current=page.contacts[0];
  await client.query("SELECT public.save_depot_contact($1,$2,'CRM edited',$3,'+12025550123')",[cid,current.revision,'edited-'+randomUUID()+'@example.invalid']);
  await client.query('RESET ROLE');
  const rev=(await client.query('SELECT revision FROM private.depot_contacts WHERE id=$1',[cid])).rows[0].revision;
  assert.equal((await client.query("SELECT status FROM private.depot_permissions WHERE contact_id=$1 AND channel='email'",[cid])).rows[0].status,'revoked');
  await client.query('SAVEPOINT link_binding');
  const oldEmailToken=(await client.query("SELECT token FROM private.depot_optout_links WHERE channel='email' AND destination=$1",[email])).rows[0].token;
  await adminRole();
  await client.query("SELECT public.set_depot_permission($1,$2,'email',true,'new endpoint proof')",[cid,rev]);
  await role('anon',{role:'anon'});
  await client.query('SELECT public.unsubscribe_depot_contact($1)',[oldEmailToken]);
  await client.query('RESET ROLE');
  assert.equal((await client.query("SELECT status FROM private.depot_permissions WHERE contact_id=$1 AND channel='email'",[cid])).rows[0].status,'granted');
  await client.query('ROLLBACK TO SAVEPOINT link_binding');
  await adminRole();
  await client.query('SELECT public.archive_depot_contact($1,$2,true)',[cid,rev]);
  await client.query('SELECT public.archive_depot_contact($1,$2,false)',[cid,rev+1]);
  phase='automatic capture';
  // Real authenticated listing INSERT exercises the existing guard and the new AFTER trigger.
  const lid=(await client.query(`INSERT INTO public.listings(title,price,seller,phone,category,status)
    VALUES('CRM trigger test',1,'CRM trigger','+12025550124','Test','pending') RETURNING id`)).rows[0].id;
  await client.query('RESET ROLE');
  const captured=(await client.query('SELECT c.* FROM private.depot_sources s JOIN private.depot_contacts c ON c.id=s.contact_id WHERE s.listing_id=$1',[lid])).rows[0];
  assert.ok(captured);assert.equal(captured.email,null);assert.equal(captured.from_listing,true);
  const member=(await client.query(`SELECT id,lower(email) email FROM auth.users WHERE email_confirmed_at IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM private.listing_admins a WHERE a.email=lower(auth.users.email)) LIMIT 1`)).rows[0];
  if(member) {
    const mapped=(await client.query('SELECT private.capture_depot_listing(-1,$1,$2,$3) id',[member.id,'member test','+12025550125'])).rows[0].id;
    assert.equal((await client.query('SELECT email FROM private.depot_contacts WHERE id=$1',[mapped])).rows[0].email,member.email);
  }
  phase='worker leases';
  // Never send. Config and synthetic delivery state are only changed inside rollback.
  await client.query("UPDATE private.depot_channels SET enabled=true,provider='test-only' WHERE channel='sms'");
  await adminRole();
  page=(await client.query('SELECT public.get_contact_depot($1,0,false) page',[email2])).rows[0].page;
  await client.query("SELECT public.set_depot_permission($1,$2,'sms',true,'new test proof')",[cid2,page.contacts[0].revision]);
  const work=(await client.query("SELECT public.queue_depot_campaign('worker','sms','','hello',now()) id")).rows[0].id;
  await role('service_role',{role:'service_role'});
  const claimed=(await client.query('SELECT public.claim_depot_deliveries(1) jobs')).rows[0].jobs;
  assert.equal(claimed.length,1);
  assert.equal((await client.query('SELECT public.check_depot_delivery($1,$2) ok',[claimed[0].id,claimed[0].lease])).rows[0].ok,true);
  await client.query('RESET ROLE');
  await client.query("UPDATE private.depot_deliveries SET lease_until=now()-interval '1 second' WHERE id=$1",[claimed[0].id]);
  await role('service_role',{role:'service_role'});
  await client.query('SELECT public.claim_depot_deliveries(25)');
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT status FROM private.depot_deliveries WHERE id=$1',[claimed[0].id])).rows[0].status,'unknown');
  await adminRole();await client.query('SELECT public.cancel_depot_campaign($1)',[work]);
  await client.query('ROLLBACK');
  console.log('Contact DB checks passed: admin-only access, auto capture, manual CRUD, conflicts, explicit consent, destination-wide opt-out, deduplication, archive, blocked providers and non-replayed worker leases. All fixture data rolled back; no messages sent.');
}catch(e){console.error('Contact DB check failed:',phase,e.code||e.name);
  if(e.code==='42601')console.error(e.message,e.position||e.internalPosition);
  if(e.name==='AssertionError')console.error('Assertion line:',e.stack.split('\n').find(l=>l.includes('check-contact-depot-database')));
  process.exitCode=1;
}finally{await client.query('ROLLBACK').catch(()=>{});await client.end();}