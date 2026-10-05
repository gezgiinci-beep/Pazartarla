import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserConnection, requireBuildConnection } from '../build/browserConnection.mjs';
import { readAds, adMediaUrl } from '../src/lib/advertisements.ts';

test('missing settings stop publication, without disclosing credentials', () => {
  assert.throws(() => requireBuildConnection(browserConnection({})), /Yayın derlemesi durduruldu/);
  assert.throws(() => requireBuildConnection(browserConnection({ VITE_SUPABASE_URL: 'https://example.invalid' })), /eksik/);
});
test('canonical settings and publishable-key alias are embedded consistently', () => {
  const c = browserConnection({ VITE_SUPABASE_URL: ' https://example.invalid/// ', SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_fixture ' });
  assert.deepEqual(c, { url: 'https://example.invalid', key: 'sb_publishable_fixture' });
  requireBuildConnection(c);
  assert.equal(browserConnection({ VITE_SUPABASE_ANON_KEY: 'canonical', SUPABASE_PUBLISHABLE_KEY: 'fallback' }).key, 'canonical');
});
test('invalid addresses and privileged browser credentials are rejected', () => {
  for (const url of ['not-a-url', 'file:///tmp/test', 'https://user:password@example.invalid', 'https://example.invalid?key=x']) {
    assert.throws(() => requireBuildConnection({ url, key: 'sb_publishable_fixture' }), /geçerli/);
  }
  assert.throws(() => requireBuildConnection({ url: 'https://example.invalid', key: 'sb_secret_fixture' }), /gizli servis/);
  const jwt = 'header.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature';
  assert.throws(() => requireBuildConnection({ url: 'https://example.invalid', key: jwt }), /yalnız anonim/);
});
test('advertisements fail clearly before any request if connection is absent', async () => {
  let calls = 0;
  const request = async () => { calls++; throw new Error('Unexpected request'); };
  await assert.rejects(readAds(undefined, {}, request), /Sunucu bağlantı ayarları eksik/);
  await assert.rejects(readAds('invalid', {}, request), /bağlantı adresi geçersiz/);
  assert.throws(() => adMediaUrl(undefined, { media_path: 'fixture/photo.png' }), /Sunucu bağlantı ayarları eksik/);
  assert.equal(calls, 0);
});
