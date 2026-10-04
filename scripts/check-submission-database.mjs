import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {testDatabaseConfig,assertTestEnvironment} from './safety/database-target.mjs';
import pg from 'pg';

const client = new pg.Client(testDatabaseConfig());

let began = false;
try {
  await client.connect();
  await assertTestEnvironment(client);
  await client.query('BEGIN');
  began = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  const before = (await client.query('SELECT count(*)::int AS count FROM public.listings')).rows[0].count;
  const account = (await client.query(`SELECT u.id, lower(u.email) AS email
    FROM auth.users u JOIN private.listing_admins a ON lower(u.email) = a.email
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous, false) LIMIT 1`)).rows[0];
  assert.ok(account, 'A verified allowlisted account is needed for rollback-only checks.');
  // Test fixtures and temporary authorization changes are never committed.
  await client.query('DELETE FROM private.listing_submission_log WHERE user_id = $1', [account.id]);
  const asUser = async () => {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ role: 'authenticated', sub: account.id, email: account.email }),
    ]);
    await client.query('SET LOCAL ROLE authenticated');
  };
  const asAnon = async () => {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'anon' })]);
    await client.query('SET LOCAL ROLE anon');
  };
  const insert = (status = 'pending') => client.query(
    `INSERT INTO public.listings(title,price,category,seller,phone,status,created_at,submitted_by)
     VALUES($1,1,$2,$3,$4,$5,'2000-01-01','00000000-0000-0000-0000-000000000000')
     RETURNING id,status,submitted_by,created_at`,
    ['Rollback-only moderation check', 'Test', 'Test', '00000000000', status],
  );
  const expectFailure = async (operation, expected) => {
    await client.query('SAVEPOINT expected_failure');
    let caught;
    try { await operation(); } catch (error) { caught = error; }
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    assert.ok(caught, 'A forbidden operation must fail.');
    assert.ok(caught.code === expected || caught.message === expected, 'Unexpected denial reason.');
  };

  await client.query('DELETE FROM private.listing_admins WHERE email = $1', [account.email]);
  await asUser();
  await expectFailure(() => insert('approved'), 'LISTING_APPROVAL_REQUIRED');
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const row = (await insert()).rows[0];
    ids.push(row.id);
    assert.equal(row.status, 'pending');
    assert.equal(row.submitted_by, account.id, 'Spoofed ownership must be overwritten.');
    assert.ok(new Date(row.created_at).getFullYear() > 2000, 'Spoofed timestamps must be overwritten.');
  }
  await expectFailure(() => insert(), 'LISTING_DAILY_LIMIT_REACHED');
  assert.equal((await client.query('SELECT public.get_listing_submission_quota() AS q')).rows[0].q.remaining, 0);

  await asAnon();
  assert.equal((await client.query('SELECT id FROM public.listings WHERE id = ANY($1::int[])', [ids])).rowCount, 0);
  await expectFailure(() => insert(), '42501');
  assert.equal((await client.query('SELECT public.get_listing_submission_quota() AS q')).rows[0].q.remaining, 0);

  await client.query('RESET ROLE');
  await client.query('DELETE FROM private.listing_admins WHERE email = $1', [account.email]);
  await asUser();
  assert.equal((await client.query('SELECT public.is_listing_admin() AS allowed')).rows[0].allowed, false);
  assert.equal((await client.query('SELECT id FROM public.listings WHERE id = ANY($1::int[])', [ids])).rowCount, 3);
  assert.equal((await client.query("UPDATE public.listings SET status='approved' WHERE id=$1 RETURNING id", [ids[0]])).rowCount, 0);
  assert.equal((await client.query('DELETE FROM public.listings WHERE id=$1 RETURNING id', [ids[0]])).rowCount, 0);
  await expectFailure(() => client.query('SELECT * FROM private.listing_submission_log'), '42501');

  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ role: 'authenticated', sub: '00000000-0000-0000-0000-000000000000' }),
  ]);
  await client.query('SET LOCAL ROLE authenticated');
  await expectFailure(() => insert(), 'LISTING_VERIFIED_ACCOUNT_REQUIRED');
  assert.equal((await client.query('SELECT id FROM public.listings WHERE id = ANY($1::int[])', [ids])).rowCount, 0);

  await client.query('RESET ROLE');
  await client.query('INSERT INTO private.listing_admins(email) VALUES($1)', [account.email]);
  await asUser();
  assert.equal((await client.query("UPDATE public.listings SET status='approved' WHERE id=$1 RETURNING id", [ids[0]])).rowCount, 1);
  assert.equal((await client.query("UPDATE public.listings SET status='rejected' WHERE id=$1 RETURNING id", [ids[1]])).rowCount, 1);
  assert.equal((await client.query('DELETE FROM public.listings WHERE id=$1 RETURNING id', [ids[2]])).rowCount, 1);
  for (let i = 0; i < 5; i++) {
    assert.equal((await insert()).rows[0].status, 'pending');
  }
  const adminQuota = (await client.query('SELECT public.get_listing_submission_quota() AS q')).rows[0].q;
  assert.equal(adminQuota.unlimited, true);
  assert.equal(adminQuota.limit, null);
  assert.equal(adminQuota.remaining, null);
  await client.query('RESET ROLE');
  await client.query('DELETE FROM private.listing_admins WHERE email = $1', [account.email]);
  await asUser();
  assert.equal((await client.query('SELECT public.get_listing_submission_quota() AS q')).rows[0].q.unlimited, false);
  await expectFailure(() => insert(), 'LISTING_DAILY_LIMIT_REACHED');
  await asAnon();
  assert.equal((await client.query('SELECT id FROM public.listings WHERE id = ANY($1::int[])', [ids])).rowCount, 1);
  await client.query('RESET ROLE');
  await client.query('ROLLBACK');
  began = false;
  assert.equal((await client.query('SELECT count(*)::int AS count FROM public.listings')).rows[0].count, before);
  console.log('Database checks passed: unlimited administrator submissions, limited member submissions, role revocation, verified identity, moderation, and rollback.');
} catch (error) {
  // Do not expose emails, connection strings, or driver error details.
  console.error('Database check failed:', error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
} finally {
  if (began) await client.query('ROLLBACK').catch(() => {});
  await client.end().catch(() => {});
}