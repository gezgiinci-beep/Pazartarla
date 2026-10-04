import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
const url = new URL(process.env.SUPABASE_DATABASE_URL);
const ref = 'srbarfjzsfkmglsnmbtw';
assert.ok(url.hostname === `db.${ref}.supabase.co` || (
  url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith(`.${ref}`)
), 'Refusing another database.');
for (const k of ['sslmode','sslrootcert','sslcert','sslkey','ssl']) url.searchParams.delete(k);
const c = new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:12000,
  ssl:{ca:[...rootCertificates,readFileSync(process.env.SUPABASE_DATABASE_CA_FILE || '/tmp/pazartarla-supabase-ca.crt','utf8')],rejectUnauthorized:true}});
let stage = 'setup';
try {
  await c.connect(); await c.query('BEGIN');
  await c.query("SET LOCAL statement_timeout='15s'");
  if (process.argv.includes('--with-migration')) {
    const sql = readFileSync(new URL('../supabase/migrations/20261004_listing_expiry.sql',import.meta.url),'utf8');
    await c.query(sql.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,''));
  }
  const admin = (await c.query(`SELECT u.id,lower(u.email) AS email FROM auth.users u
    JOIN private.listing_admins a ON a.email=lower(u.email) WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];
  assert.ok(admin,'Verified authorized administrator required.');
  const role = async (adminRole) => {
    await c.query('RESET ROLE');
    await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(adminRole ?
      {role:'authenticated',sub:admin.id,email:admin.email} :
      {role:'authenticated',sub:'00000000-0000-0000-0000-000000000000',email:'lifetime-check@example.invalid'})]);
    await c.query('SET LOCAL ROLE authenticated');
  };
  const denied = async (sql,args,code) => {
    await c.query('SAVEPOINT denied'); let failure;
    try { await c.query(sql,args); } catch(e) { failure=e.code; }
    await c.query('ROLLBACK TO SAVEPOINT denied'); assert.equal(failure,code);
  };
  stage='calendar month and timezone boundaries';
  for (const [created,expected] of [
    ['2026-01-31T09:00:00+03:00','2026-09-30T09:00:00+03:00'],
    ['2023-06-30T09:00:00+03:00','2024-02-29T09:00:00+03:00'],
    ['2024-06-30T09:00:00+03:00','2025-02-28T09:00:00+03:00'],
    ['2026-01-31T22:30:00Z','2026-09-30T22:30:00Z'],
  ]) {
    const r = (await c.query(`SELECT (($1::timestamptz AT TIME ZONE 'Europe/Istanbul') + interval '8 months') AT TIME ZONE 'Europe/Istanbul' AS expires`,[created])).rows[0];
    assert.equal(r.expires.getTime(),Date.parse(expected));
  }
  await role(true); stage='trusted creation timestamp';
  const ids = [];
  for (let i=0;i<2;i++) {
    const row = (await c.query(`INSERT INTO public.listings(title,price,category,seller,phone,status,created_at,image)
      VALUES('Rollback-only lifetime fixture',1,'Test','Test','00000000000','pending','2000-01-01','https://example.invalid/fixture.jpg')
      RETURNING id,created_at,expires_at`)).rows[0];
    ids.push(row.id);
    assert.ok(row.created_at.getTime()>Date.now()-60_000,'Spoofed birth date must be replaced.');
    await c.query("UPDATE public.listings SET status='approved' WHERE id=$1",[row.id]);
    assert.equal((await c.query('SELECT expires_at FROM public.listings WHERE id=$1',[row.id])).rows[0].expires_at.getTime(),row.expires_at.getTime());
  }
  stage='past-expiry fixture without altering real records';
  await c.query('RESET ROLE');
  const old = (await c.query("UPDATE public.listings SET created_at='2001-01-31T09:00:00+02:00' WHERE id=$1 RETURNING expires_at",[ids[0]])).rows[0];
  assert.equal(old.expires_at.getTime(),Date.parse('2001-09-30T09:00:00+03:00'));
  stage='anonymous visibility and archive privacy';
  await c.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)"); await c.query('SET LOCAL ROLE anon');
  assert.equal((await c.query('SELECT id FROM public.listings WHERE id=$1',[ids[0]])).rowCount,0);
  assert.equal((await c.query('SELECT id FROM public.listings WHERE id=$1',[ids[1]])).rowCount,1);
  await denied('SELECT * FROM public.listing_archive',[],'42501');
  stage='member and administrator archive access';
  await role(false);
  assert.equal((await c.query('SELECT * FROM public.listing_archive WHERE id=$1',[ids[0]])).rowCount,0);
  await role(true);
  assert.equal((await c.query('SELECT * FROM public.listing_archive WHERE id=$1',[ids[0]])).rowCount,1);
  assert.equal((await c.query('SELECT * FROM public.listing_archive WHERE id=$1',[ids[1]])).rowCount,0);
  stage='edits cannot restart the eight-month clock';
  await denied('UPDATE public.listings SET created_at=now() WHERE id=$1',[ids[0]],'42501');
  await denied('UPDATE public.listings SET expires_at=now() WHERE id=$1',[ids[0]],'428C9');
  const edited = (await c.query("UPDATE public.listings SET title='Edited archive fixture' WHERE id=$1 RETURNING expires_at",[ids[0]])).rows[0];
  assert.equal(edited.expires_at.getTime(),old.expires_at.getTime());
  assert.equal((await c.query('SELECT id FROM public.listing_archive WHERE id=$1',[ids[0]])).rowCount,1);
  await c.query('RESET ROLE'); await c.query('ROLLBACK');
  assert.equal((await c.query('SELECT id FROM public.listings WHERE id=ANY($1::int[])',[ids])).rowCount,0);
  console.log('Lifetime DB checks passed: eight calendar months, Istanbul/leap-year boundaries, trusted immutable dates, public expiry, admin-only archive and retained records. All fixtures and optional test setup rolled back; no media changed.');
} catch(e) {
  console.error('Lifetime DB check failed:',stage,e.code||e.name||'UNKNOWN'); process.exitCode=1;
} finally { await c.query('ROLLBACK').catch(()=>{}); await c.end().catch(()=>{}); }