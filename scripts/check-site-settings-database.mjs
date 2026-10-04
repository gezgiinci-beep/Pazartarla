import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import pg from 'pg';

const url = new URL(process.env.SUPABASE_DATABASE_URL);
const project = 'srbarfjzsfkmglsnmbtw';
assert.ok(url.hostname === `db.${project}.supabase.co`
  || (url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith(`.${project}`)),
  'Refusing to test another database.');
for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) url.searchParams.delete(key);
const client = new pg.Client({
  connectionString: url.toString(), connectionTimeoutMillis: 12000,
  ssl: {
    ca: [...rootCertificates, readFileSync(process.env.SUPABASE_DATABASE_CA_FILE || '/tmp/pazartarla-supabase-ca.crt', 'utf8')],
    rejectUnauthorized: true
  }
});

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout = '15s'");
  const original = (await client.query("SELECT * FROM public.site_settings WHERE id='public'")).rows[0];
  assert.ok(original, 'A seeded site settings record is required.');
  const admin = (await client.query(`SELECT u.id, lower(u.email) AS email
    FROM auth.users u JOIN private.listing_admins a ON a.email=lower(u.email)
    WHERE u.email_confirmed_at IS NOT NULL LIMIT 1`)).rows[0];
  assert.ok(admin, 'A verified database-authorized admin is required.');
  const asRole = async (role, claims) => {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
    assert.ok(['anon', 'authenticated'].includes(role));
    await client.query('SET LOCAL ROLE ' + role);
  };
  const denied = async (query, params) => {
    await client.query('SAVEPOINT denied');
    let code;
    try { await client.query(query, params); } catch (error) { code = error.code; }
    await client.query('ROLLBACK TO SAVEPOINT denied');
    assert.equal(code, '42501');
  };
  await asRole('anon', { role: 'anon' });
  assert.equal((await client.query("SELECT id FROM public.site_settings WHERE id='public'")).rowCount, 1);
  await denied("UPDATE public.site_settings SET announcement='Forbidden' WHERE id='public'");
  await denied("DELETE FROM public.site_settings WHERE id='public'");
  await asRole('authenticated', { role: 'authenticated', sub: '00000000-0000-0000-0000-000000000000', email: 'settings-check@example.invalid' });
  assert.equal((await client.query("UPDATE public.site_settings SET announcement='Forbidden' WHERE id='public' RETURNING id")).rowCount, 0);
  await denied("INSERT INTO public.site_settings(id,announcement,categories) VALUES('public','Forbidden',$1)", [JSON.stringify(original.categories)]);
  await denied("UPDATE public.site_settings SET revision=99 WHERE id='public'");
  await asRole('authenticated', { role: 'authenticated', sub: admin.id, email: admin.email });
  const saved = (await client.query(`UPDATE public.site_settings SET announcement=$1
    WHERE id='public' AND revision=$2 RETURNING *`, ['Rollback-only settings check', original.revision])).rows[0];
  assert.equal(saved.announcement, 'Rollback-only settings check');
  assert.equal(saved.revision, original.revision + 1);
  assert.deepEqual(saved.categories, original.categories);
  assert.equal((await client.query("UPDATE public.site_settings SET announcement='Stale' WHERE id='public' AND revision=$1 RETURNING id", [original.revision])).rowCount, 0);
  const categories = { ...original.categories, 'Rollback check': ['Genel', 'Alt seçenek'] };
  const changed = (await client.query("UPDATE public.site_settings SET categories=$1 WHERE id='public' RETURNING *", [JSON.stringify(categories)])).rows[0];
  assert.deepEqual(changed.categories['Rollback check'], ['Genel', 'Alt seçenek']);
  assert.equal(changed.announcement, saved.announcement);
  delete categories['Rollback check'];
  await client.query("UPDATE public.site_settings SET categories=$1,announcement='' WHERE id='public'", [JSON.stringify(categories)]);
  await asRole('anon', { role: 'anon' });
  const publicRow = (await client.query("SELECT * FROM public.site_settings WHERE id='public'")).rows[0];
  assert.equal(publicRow.announcement, '');
  assert.deepEqual(publicRow.categories, original.categories);
  await client.query('RESET ROLE');
  await client.query('ROLLBACK');
  assert.deepEqual((await client.query("SELECT * FROM public.site_settings WHERE id='public'")).rows[0], original);
  console.log('Settings DB checks passed: public reads, admin-only writes, category changes, blank announcement, stale-write rejection. All test writes rolled back.');
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}