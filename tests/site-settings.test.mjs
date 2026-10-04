import assert from 'node:assert/strict';
import test from 'node:test';
import { validCategories, parseSiteSettings, readSiteSettings, writeSiteSettings, SettingsConflictError } from '../src/lib/siteSettings.ts';

const row = { id: 'public', announcement: 'Ortak duyuru', categories: { Mahsuller: ['Ceviz'] }, revision: 1 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('settings validate without treating an empty announcement as a missing record', () => {
  assert.equal(parseSiteSettings({ ...row, announcement: '' }).announcement, '');
  assert.throws(() => parseSiteSettings({ ...row, revision: 0 }));
  assert.throws(() => parseSiteSettings({ ...row, id: 'other' }));
});

test('category validation rejects empty, malformed, unsafe or duplicate data', () => {
  for (const value of [{}, [], { ' ': ['Test'] }, { A: [] }, { A: [''] }, { A: ['X', 'X'] },
    { A: [1] }, { A: [' Test '] }, { ['__proto__']: ['Genel'] }, { A: ['x'.repeat(101)] }]) {
    assert.equal(validCategories(value), false);
  }
  assert.equal(validCategories({ Tarım: ['Ekipman', 'Ceviz'] }), true);
});

test('a fresh anonymous read requests the canonical record without a browser cache or admin session', async () => {
  const calls = [];
  const request = async (url, init) => { calls.push({ url, init }); return json([row]); };
  assert.deepEqual(await readSiteSettings('https://example.invalid', 'public-key', request), row);
  assert.deepEqual(await readSiteSettings('https://example.invalid', 'public-key', request), row);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.headers.apikey, 'public-key');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.match(calls[0].url, /id=eq.public/);
});

test('missing records and server failures never silently use hardcoded defaults', async () => {
  await assert.rejects(readSiteSettings('https://example.invalid', 'key', async () => json([])), /kaydı bulunamadı/);
  await assert.rejects(readSiteSettings('https://example.invalid', 'key', async () => json({}, 404)), /kurulmamış/);
  await assert.rejects(readSiteSettings('https://example.invalid', 'key', async () => json({}, 500)), /HTTP 500/);
  await assert.rejects(readSiteSettings('https://example.invalid', 'key', async () => { throw new Error('Network unavailable'); }), /Network/);
});

test('announcement writes are revision-checked patches, including intentionally blank announcements', async () => {
  const saved = { ...row, announcement: '', revision: 2 };
  const result = await writeSiteSettings('https://example.invalid', { Authorization: 'Bearer test-session' }, 1, { announcement: '' },
    async (url, init) => {
      assert.match(url, /revision=eq.1/);
      assert.equal(init.method, 'PATCH');
      assert.equal(init.headers.Authorization, 'Bearer test-session');
      assert.equal(init.headers.Prefer, 'return=representation');
      assert.deepEqual(JSON.parse(init.body), { announcement: '' });
      return json([saved]);
    });
  assert.deepEqual(result, saved);
});

test('category add/remove writes do not send or overwrite the announcement', async () => {
  const categories = { ...row.categories, Yeni: ['Genel', 'Alt'] };
  const saved = await writeSiteSettings('https://example.invalid', {}, 1, { categories }, async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body), { categories });
    return json([{ ...row, categories, revision: 2 }]);
  });
  assert.equal(saved.announcement, row.announcement);
  assert.deepEqual(saved.categories.Yeni, ['Genel', 'Alt']);
});

test('stale writes and unacknowledged writes cannot report success', async () => {
  await assert.rejects(writeSiteSettings('https://example.invalid', {}, 1, { announcement: 'New' }, async () => json([])), SettingsConflictError);
  await assert.rejects(writeSiteSettings('https://example.invalid', {}, 1, { announcement: 'New' }, async () => json([row])), /doğrulamadı/);
});

test('invalid or broad patches are rejected before making a request', async () => {
  const request = async () => { assert.fail('No invalid mutation should reach the API'); };
  for (const patch of [{}, { revision: 99 }, { categories: {} }, { announcement: 'x'.repeat(1001) },
    { announcement: 'New', categories: row.categories }]) {
    await assert.rejects(writeSiteSettings('https://example.invalid', {}, 1, patch, request));
  }
});

test('unauthorized writes and service outages have visible, actionable error messages', async () => {
  for (const status of [401, 403]) {
    await assert.rejects(writeSiteSettings('https://example.invalid', {}, 1, { announcement: 'New' }, async () => json({}, status)), /erişim reddedildi/);
  }
  await assert.rejects(writeSiteSettings('https://example.invalid', {}, 1, { categories: row.categories }, async () => json({}, 503)), /HTTP 503/);
});