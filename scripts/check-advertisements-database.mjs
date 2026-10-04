import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import pg from 'pg';

const url = new URL(process.env.SUPABASE_DATABASE_URL);
const ref = 'srbarfjzsfkmglsnmbtw';
assert.ok(url.hostname === `db.${ref}.supabase.co` || (
  url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith(`.${ref}`)
), 'Refusing another database.');
for (const k of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) url.searchParams.delete(k);
const c = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 12000,
  ssl: { ca: [...rootCertificates, readFileSync(process.env.SUPABASE_DATABASE_CA_FILE || '/tmp/pazartarla-supabase-ca.crt','utf8')], rejectUnauthorized: true } });
let stage = 'setup';
try {
  await c.connect(); await c.query('BEGIN'); await c.query("SET LOCAL statement_timeout='15s'");
  const before = (await c.query('SELECT count(*)::int AS n FROM public.advertisements')).rows[0].n;
  const admin = (await c.query(`SELECT u.id,lower(u.email) AS email FROM auth.users u
    JOIN private.listing_admins a ON a.email=lower(u.email) WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];
  assert.ok(admin, 'A verified authorized admin is required.');
  const id = '00000000-0000-4000-8000-000000000011';
  const path = id + '/00000000-0000-4000-8000-000000000012.jpg';
  const role = async (adminRole) => {
    await c.query('RESET ROLE');
    const claims = adminRole ? {role:'authenticated',sub:admin.id,email:admin.email} :
      {role:'authenticated',sub:'00000000-0000-0000-0000-000000000000',email:'ads-check@example.invalid'};
    await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
    await c.query('SET LOCAL ROLE authenticated');
  };
  const denied = async (sql, args=[]) => {
    await c.query('SAVEPOINT denied'); let code;
    try { await c.query(sql,args); } catch(e) { code=e.code; }
    await c.query('ROLLBACK TO SAVEPOINT denied'); assert.equal(code,'42501');
  };
  await role(false);
  stage = 'member mutation denials';
  await denied("INSERT INTO public.advertisements(id,title,media_path,media_type) VALUES($1,'Forbidden',$2,'image')",[id,path]);
  await denied("INSERT INTO storage.objects(bucket_id,name) VALUES('site-advertisements',$1)",[path]);
  await role(true);
  stage = 'admin record creation';
  const created = (await c.query(`INSERT INTO public.advertisements(id,title,media_path,media_type,is_active)
    VALUES($1,'Rollback-only ad',$2,'image',false) RETURNING *`,[id,path])).rows[0];
  assert.equal(created.created_by,admin.id); assert.equal(created.revision,1);
  stage = 'admin media metadata fixture';
  await c.query("INSERT INTO storage.objects(bucket_id,name) VALUES('site-advertisements',$1)",[path]);
  await role(false);
  stage = 'member draft privacy and mutation denials';
  assert.equal((await c.query('SELECT id FROM public.advertisements WHERE id=$1',[id])).rowCount,0);
  assert.equal((await c.query("UPDATE public.advertisements SET is_active=true WHERE id=$1 RETURNING id",[id])).rowCount,0);
  assert.equal((await c.query('DELETE FROM public.advertisements WHERE id=$1 RETURNING id',[id])).rowCount,0);
  assert.equal((await c.query("UPDATE storage.objects SET metadata='{}' WHERE bucket_id='site-advertisements' AND name=$1 RETURNING id",[path])).rowCount,0);
  await denied("DELETE FROM storage.objects WHERE bucket_id='site-advertisements' AND name=$1 RETURNING id",[path]);
  await role(true);
  stage = 'admin publish and revision checks';
  const published = (await c.query('UPDATE public.advertisements SET is_active=true WHERE id=$1 AND revision=1 RETURNING *',[id])).rows[0];
  assert.equal(published.revision,2);
  assert.equal((await c.query("UPDATE public.advertisements SET title='Stale' WHERE id=$1 AND revision=1 RETURNING id",[id])).rowCount,0);
  await denied('UPDATE public.advertisements SET revision=99 WHERE id=$1',[id]);
  await c.query('RESET ROLE'); await c.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',true)");
  stage = 'anonymous published reads';
  await c.query('SET LOCAL ROLE anon');
  assert.equal((await c.query('SELECT id FROM public.advertisements WHERE id=$1',[id])).rowCount,1);
  await denied('DELETE FROM public.advertisements WHERE id=$1',[id]);
  await role(true);
  stage = 'admin deletion';
  assert.equal((await c.query('DELETE FROM public.advertisements WHERE id=$1 AND revision=2 RETURNING id',[id])).rowCount,1);
  // Storage metadata fixture is rollback-only. Actual file deletion must use Storage API.
  await c.query('RESET ROLE'); await c.query('ROLLBACK');
  assert.equal((await c.query('SELECT count(*)::int AS n FROM public.advertisements')).rows[0].n,before);
  console.log('Ad DB checks passed: admin-only records/storage writes, draft privacy, anonymous published reads, revision checks and deletion. All fixtures rolled back; no actual media uploaded/deleted.');
} catch(e) {
  console.error('Ad DB check failed:',stage,e.code || e.name || 'UNKNOWN'); process.exitCode=1;
} finally { await c.query('ROLLBACK').catch(()=>{}); await c.end().catch(()=>{}); }