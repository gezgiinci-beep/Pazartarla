import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../supabase/reviewed_changes/20261013_store_publication_admin.sql',import.meta.url),'utf8');

test('Store removal is a reversible visibility change, not a destructive delete',()=>{
  assert.match(migration,/ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true/i);
  assert.match(migration,/SET is_public = p_is_public/i);
  assert.doesNotMatch(migration,/\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration,/DROP TABLE/i);
  assert.match(migration,/never deletes stores, listings,[\s\S]*?memberships, payment history/i);
});

test('Public data hides unpublished stores and their store-page listings',()=>{
  assert.match(migration,/WHERE s\.is_public/i);
  assert.match(migration,/jsonb_set\(data, '\{store\}', 'null'::jsonb, true\)/i);
  assert.match(migration,/jsonb_set\(data, '\{listings\}', '\[\]'::jsonb, true\)/i);
});

test('Publication mutation checks verified admin authority and an optimistic revision',()=>{
  assert.match(migration,/public\.is_verified_listing_submitter\(\)/i);
  assert.match(migration,/public\.is_listing_admin\(\)/i);
  assert.match(migration,/s\.revision = p_revision/i);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.set_store_publication\(uuid, integer, boolean\) TO authenticated/i);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.set_store_publication\(uuid, integer, boolean\) FROM PUBLIC/i);
});

test('Only currently active member stores appear in the admin publication list',()=>{
  assert.match(migration,/JOIN private\.store_memberships m ON m\.owner_id = s\.owner_id/i);
  assert.match(migration,/m\.starts_at <= now\(\) AND m\.ends_at > now\(\)/i);
  assert.match(migration,/admin_stores/i);
});
