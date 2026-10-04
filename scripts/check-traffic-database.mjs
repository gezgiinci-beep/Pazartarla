import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabaseConfig,assertTestEnvironment} from './safety/database-target.mjs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const client=new pg.Client(testDatabaseConfig());
try {
  await client.connect();await assertTestEnvironment(client);await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='15s'");
  const sql=readFileSync(new URL('../supabase/migrations/20261004_traffic_analytics.sql',import.meta.url),'utf8');
  await client.query(sql.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,''));
  const before=Number((await client.query('SELECT count(*) n FROM private.traffic_views')).rows[0].n);
  const admin=(await client.query(`SELECT u.id,lower(u.email) email FROM auth.users u
    JOIN private.listing_admins a ON a.email=lower(u.email) WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];
  assert.ok(admin);
  const listing=(await client.query("SELECT id::text id FROM public.listings WHERE status='approved' AND created_at+interval '8 months'>now() LIMIT 1")).rows[0];
  assert.ok(listing,'An approved active listing is needed.');
  async function role(name,claims) {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
    await client.query('SET LOCAL ROLE '+name);
  }
  async function denied(query,params=[],expected='42501') {
    await client.query('SAVEPOINT rejection');
    let code;try {await client.query(query,params);}catch(e){code=e.code;}
    await client.query('ROLLBACK TO SAVEPOINT rejection');assert.equal(code,expected);
  }
  await role('anon',{role:'anon'});
  await denied('SELECT * FROM private.traffic_views');
  await denied('SELECT public.get_traffic_report(7)');
  assert.equal((await client.query('SELECT public.traffic_collector_status() status')).rows[0].status.ready,true);
  await role('authenticated',{role:'authenticated',sub:randomUUID(),email:'traffic-check@example.invalid'});
  await denied('SELECT public.get_traffic_report(7)');
  await denied('SELECT * FROM private.traffic_views');
  const a=randomUUID(),b=randomUUID(),s1=randomUUID(),s2=randomUUID(),s3=randomUUID();
  const rows=[
    [randomUUID(),a,s1,'home',null,20,'TR','34'],
    [randomUUID(),a,s2,'detail',listing.id,40,'TR','34'],
    [randomUUID(),b,s3,'home',null,60,'TR','06'],
    [randomUUID(),b,s3,'favorites',null,0,null,null]
  ];
  async function record(r) {
    return (await client.query('SELECT public.record_traffic_view($1,$2,$3,$4,$5,$6,$7,$8) ok',r)).rows[0].ok;
  }
  await role('anon',{role:'anon'});
  for(const r of rows)assert.equal(await record(r),true);
  await client.query('RESET ROLE');
  await client.query("UPDATE private.traffic_views SET started_at=now()-interval '120 seconds' WHERE view_id=ANY($1::uuid[])",[rows.map(r=>r[0])]);
  await role('anon',{role:'anon'});
  for(const r of rows)assert.equal(await record(r),true);
  assert.equal(await record([...rows[0].slice(0,5),10,...rows[0].slice(6)]),true);
  await denied('UPDATE private.traffic_views SET active_seconds=999');
  await denied('SELECT public.record_traffic_view($1,$2,$3,$4,$5,$6,$7,$8)',[rows[0][0],b,s1,'home',null,0,'TR','34'],'22023');
  await denied('SELECT public.record_traffic_view($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),a,s1,'admin-page',null,0,null,null],'22023');
  await role('authenticated',{role:'authenticated',sub:admin.id,email:admin.email});
  for(const period of [7,30,90]) {
    const report=(await client.query('SELECT public.get_traffic_report($1) report',[period])).rows[0].report;
    assert.equal(report.daily.length,period);
    if(before===0) {
      assert.deepEqual(report.summary,{total_views:4,unique_browsers:2,total_sessions:3,detail_views:1,
        total_active_seconds:120,avg_session_seconds:40,visits_per_browser:1.5,returning_rate:50});
      assert.equal(report.regions.find(r=>r.region==='34').share_percent,50);
      assert.equal(report.regions.find(r=>r.region==='34').visits_per_browser,2);
      assert.equal(report.regions.find(r=>r.country===null).views,1);
      assert.equal(report.listings[0].share_percent,100);
      assert.equal(report.daily.reduce((s,d)=>s+d.views,0),4);
    }
  }
  await denied('SELECT public.get_traffic_report(365)',[],'22023');
  await role('anon',{role:'anon'});
  await record([...rows[0].slice(0,5),40000,...rows[0].slice(6)]);
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT active_seconds FROM private.traffic_views WHERE view_id=$1',[rows[0][0]])).rows[0].active_seconds,120);
  const limitedBrowser=randomUUID(),limitedSession=randomUUID();
  await client.query(`INSERT INTO private.traffic_views(view_id,visitor_id,session_id,route)
    SELECT gen_random_uuid(),$1::uuid,$2::uuid,'home' FROM generate_series(1,240)`,[limitedBrowser,limitedSession]);
  await role('anon',{role:'anon'});
  await denied('SELECT public.record_traffic_view($1,$2,$3,$4,$5,$6,$7,$8)',
    [randomUUID(),limitedBrowser,limitedSession,'home',null,0,null,null],'54000');
  await client.query('RESET ROLE');
  await client.query("UPDATE private.traffic_views SET started_at=now()-interval '91 days' WHERE view_id=$1",[rows[0][0]]);
  await role('anon',{role:'anon'});
  await client.query('SELECT public.traffic_collector_status()');
  await client.query('RESET ROLE');
  assert.equal((await client.query('SELECT 1 FROM private.traffic_views WHERE view_id=$1',[rows[0][0]])).rowCount,0);
  await client.query('ROLLBACK');
  console.log('Traffic DB checks passed: private reports, public bounded/idempotent collection, time caps, region/frequency/share calculations, period boundaries and retention. All fixture events rolled back.');
}catch(e){console.error('Traffic DB checks failed:',e.code||e.name);
  if(e.code==='42601')console.error(e.message,'SQL position:',e.position||e.internalPosition);
  process.exitCode=1;}
finally{await client.query('ROLLBACK').catch(()=>{});await client.end();}