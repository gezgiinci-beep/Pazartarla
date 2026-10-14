import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyListingMetadataUrl,
  listingSeoMetadataUrl,
  publicListingsUrl,
  readPublicListings,
} from '../src/lib/publicListingRequests.mjs';
import { AUTOMATIC_REFRESH_INTERVAL_MS, automaticRefreshDue } from '../src/lib/refreshPolicy.mjs';

const base = 'https://project.example';

test('public listing reads select visible fields but omit legacy photo/SEO metadata', () => {
  const url = new URL(publicListingsUrl(base));
  const columns = url.searchParams.get('select').split(',');
  assert.ok(columns.includes('title'));
  assert.ok(columns.includes('gallery_paths'));
  assert.ok(columns.includes('is_featured'));
  assert.ok(columns.includes('submitted_by'));
  assert.ok(!columns.includes('*'));
  assert.ok(!columns.includes('seotags'));
  assert.equal(url.searchParams.get('status'), 'eq.approved');
  assert.equal(url.searchParams.get('order'), 'created_at.desc');
});

test('modern rows require one request; legacy metadata is fetched only for incomplete rows', async () => {
  const modern = { id: 2, gallery_paths: [], is_featured: false };
  const old = { id: 8, gallery_paths: null, is_featured: null };
  const calls = [];
  const request = async url => {
    calls.push(new URL(url));
    return Response.json(calls.length === 1 ? [modern, old] : [{ id: 8, seotags: 'legacy' }]);
  };
  const rows = await readPublicListings(base, { apikey: 'test' }, request);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get('select').includes('seotags'), false);
  assert.equal(calls[1].searchParams.get('select'), 'id,seotags');
  assert.equal(calls[1].searchParams.get('id'), 'in.(8)');
  assert.equal(rows[0].seotags, undefined);
  assert.equal(rows[1].seotags, 'legacy');
});

test('fully migrated rows never trigger a second, large compatibility read', async () => {
  const calls = [];
  const request = async url => {
    calls.push(url);
    return Response.json([{ id: 2, gallery_paths: [], is_featured: false }]);
  };
  await readPublicListings(base, {}, request);
  assert.equal(calls.length, 1);
});

test('legacy lookup URLs validate ids and detail metadata stays scoped to one listing', () => {
  const legacy = new URL(legacyListingMetadataUrl(base, [5, 5, 9]));
  assert.equal(legacy.searchParams.get('id'), 'in.(5,9)');
  assert.equal(legacy.searchParams.get('select'), 'id,seotags');
  const detail = new URL(listingSeoMetadataUrl(base, 9));
  assert.equal(detail.searchParams.get('id'), 'eq.9');
  assert.equal(detail.searchParams.get('limit'), '1');
  assert.throws(() => legacyListingMetadataUrl(base, [0, '1)']), /kimlik listesi/);
});

test('automatic reads are cooled down for five minutes, including duplicate focus events', () => {
  assert.equal(AUTOMATIC_REFRESH_INTERVAL_MS, 300_000);
  assert.equal(automaticRefreshDue(0, 10_000), true);
  assert.equal(automaticRefreshDue(10_000, 309_999), false);
  assert.equal(automaticRefreshDue(10_000, 310_000), true);
});

test('public Supabase listing reads expose Retry-After without retrying immediately', async () => {
  await assert.rejects(
    readPublicListings(base, {}, async () => new Response('{}', {
      status: 429,
      headers: { 'retry-after': '120' },
    })),
    error => error.status === 429 && error.retryAfterMs === 120_000,
  );
});
