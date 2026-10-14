import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { assertTestEnvironment, testDatabaseConfig } from './safety/database-target.mjs';

const client = new pg.Client(testDatabaseConfig());
const migrationPath = new URL('../supabase/reviewed_changes/20261010_site_category_management.sql', import.meta.url);

try {
  await client.connect();
  await assertTestEnvironment(client);
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout = '30s'");
  const migration = await readFile(migrationPath, 'utf8');
  await client.query(migration.replace(/(^|\n)\s*BEGIN;\s*/i, '$1').replace(/\s*COMMIT;\s*$/i, ''));

  const before = (await client.query("SELECT * FROM public.site_settings WHERE id='public'")).rows[0];
  assert.ok(before, 'A seeded test settings row is required.');
  const admin = (await client.query(`SELECT u.id, lower(u.email) AS email
    FROM auth.users u JOIN private.listing_admins a ON a.email=lower(u.email)
    WHERE u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous,false) LIMIT 1`)).rows[0];
  assert.ok(admin, 'A verified test administrator is required.');

  const asRole = async (role, claims) => {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
    await client.query('SET LOCAL ROLE ' + role);
  };
  const rejected = async (fn, code) => {
    await client.query('SAVEPOINT expected_rejection');
    let caught;
    try { await fn(); } catch (error) { caught = error; }
    await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    assert.equal(caught?.code, code);
  };
  const rpc = async (name, revision, operation, token) => {
    const query = name === 'preview_site_category_change'
      ? 'SELECT public.preview_site_category_change($1,$2) AS value'
      : 'SELECT public.apply_site_category_change($1,$2,$3) AS value';
    const values = name === 'preview_site_category_change'
      ? [revision, operation] : [revision, operation, token];
    return (await client.query(query, values)).rows[0].value;
  };

  await asRole('anon', { role: 'anon' });
  await rejected(() => rpc('preview_site_category_change', before.revision, { action: 'reorder' }), '42501');
  await asRole('authenticated', {
    role: 'authenticated', sub: '00000000-0000-0000-0000-000000000000', email: 'not-admin@example.invalid'
  });
  await rejected(() => rpc('preview_site_category_change', before.revision, { action: 'reorder' }), '42501');

  await asRole('authenticated', { role: 'authenticated', sub: admin.id, email: admin.email });
  const sourceCategory = 'Category RPC Check';
  const targetCategory = 'Category RPC Target';
  const categories = {
    ...before.categories,
    [sourceCategory]: ['Original', 'Second', 'Third'],
    [targetCategory]: ['Renamed', 'Keep'],
  };
  const seeded = (await client.query(`UPDATE public.site_settings SET categories=$1
    WHERE id='public' AND revision=$2 RETURNING revision`, [JSON.stringify(categories), before.revision])).rows[0];
  assert.ok(seeded, 'Test settings update should use the current revision.');

  const listingIds = [];
  for (let i = 0; i < 2; i++) {
    const row = (await client.query(`INSERT INTO public.listings
      (title,price,category,"subCategory",seller,phone,status,submitted_by,created_at)
      VALUES ($1,10,$2,'Original','Synthetic category test','+10000000000','pending',$3,now())
      RETURNING id`, [`Category RPC test ${i + 1}`, sourceCategory, admin.id])).rows[0];
    listingIds.push(row.id);
  }

  let currentRevision = seeded.revision;
  let review = await rpc('preview_site_category_change', currentRevision, {
    action: 'rename', category: sourceCategory, name: 'Original', newName: 'Renamed',
  });
  assert.equal(review.affected_count, 2);
  await rejected(() => rpc('apply_site_category_change', currentRevision, {
    action: 'rename', category: sourceCategory, name: 'Original', newName: 'Altered',
  }, review.preview_token), '40001');
  let saved = await rpc('apply_site_category_change', currentRevision, {
    action: 'rename', category: sourceCategory, name: 'Original', newName: 'Renamed',
  }, review.preview_token);
  assert.equal(saved.affected_count, 2);
  currentRevision = saved.settings.revision;
  assert.equal(saved.settings.categories[sourceCategory][0], 'Renamed');
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.listings
    WHERE id=ANY($1::bigint[]) AND category=$2 AND "subCategory"='Renamed'`, [listingIds, sourceCategory])).rows[0].n, 2);
  await rejected(() => rpc('apply_site_category_change', currentRevision - 1, {
    action: 'rename', category: sourceCategory, name: 'Original', newName: 'Renamed',
  }, review.preview_token), '40001');

  const reorder = { action: 'reorder', category: sourceCategory, order: ['Third', 'Second', 'Renamed'] };
  review = await rpc('preview_site_category_change', currentRevision, reorder);
  assert.equal(review.affected_count, 0);
  saved = await rpc('apply_site_category_change', currentRevision, reorder, review.preview_token);
  currentRevision = saved.settings.revision;
  assert.deepEqual(saved.settings.categories[sourceCategory], reorder.order);

  const move = { action: 'move', category: sourceCategory, name: 'Renamed', targetCategory };
  review = await rpc('preview_site_category_change', currentRevision, move);
  assert.equal(review.affected_count, 2);
  saved = await rpc('apply_site_category_change', currentRevision, move, review.preview_token);
  currentRevision = saved.settings.revision;
  assert.equal(saved.settings.categories[sourceCategory].includes('Renamed'), false);
  assert.equal(saved.settings.categories[targetCategory][0], 'Renamed');
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.listings
    WHERE id=ANY($1::bigint[]) AND category=$2 AND "subCategory"='Renamed'`, [listingIds, targetCategory])).rows[0].n, 2);

  const transfer = { action: 'delete', category: targetCategory, name: 'Renamed',
    targetCategory: sourceCategory, targetName: 'Second' };
  review = await rpc('preview_site_category_change', currentRevision, transfer);
  assert.equal(review.affected_count, 2);
  saved = await rpc('apply_site_category_change', currentRevision, transfer, review.preview_token);
  assert.equal(saved.affected_count, 2);
  assert.equal(saved.settings.categories[targetCategory].includes('Renamed'), false);
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.listings
    WHERE id=ANY($1::bigint[]) AND category=$2 AND "subCategory"='Second'`, [listingIds, sourceCategory])).rows[0].n, 2);

  await client.query('RESET ROLE');
  await client.query('ROLLBACK');
  const after = (await client.query("SELECT * FROM public.site_settings WHERE id='public'")).rows[0];
  assert.deepEqual(after, before, 'All category, listing, preview-token, and migration changes must roll back.');
  console.log('Category management database checks passed on isolated test project; every settings/listing write and migration rolled back.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Category management database check failed:', error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
