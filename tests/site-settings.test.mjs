import assert from 'node:assert/strict';
import test from 'node:test';
import { validCategories, validFeaturedOffer, parseSiteSettings, readSiteSettings, writeSiteSettings, SettingsConflictError } from '../src/lib/siteSettings.ts';

const row = { id: 'public', announcement: 'Ortak duyuru', categories: { Mahsuller: ['Ceviz'] },
  featured_offer: { monthly_price_try: 150, description: '1 aylık vitrin ilanı.' }, revision: 1 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('monthly offer validates bounded amounts, cents and editable description', () => {
  assert.equal(validFeaturedOffer({ monthly_price_try: 150, description: '' }), true);
  assert.equal(validFeaturedOffer({ monthly_price_try: 0.29, description: 'Bir ay' }), true);
  for (const value of [null,{}, { monthly_price_try: -1, description: '' },
    { monthly_price_try: 0, description: '' },{ monthly_price_try: '150', description: '' },
    { monthly_price_try: 1.001, description: '' },{ monthly_price_try: 1.000000001, description: '' },
    { monthly_price_try: Infinity, description: '' },{ monthly_price_try: 1000001, description: '' },
    { monthly_price_try: 150, description: 'x'.repeat(401) },
    { monthly_price_try: 150, description: '', extra: true }]) assert.equal(validFeaturedOffer(value),false);
});

test('offer save preserves other settings and fresh independent reads get the saved price', async () => {
  let canonical = row;
  const offer = { monthly_price_try: 235.5, description: '1 aylık vitrin yayını.' };
  const request = async (_url, init) => {
    if (init.method === 'PATCH') {
      assert.deepEqual(JSON.parse(init.body), { featured_offer: offer });
      canonical = {...canonical,featured_offer:offer,revision:canonical.revision+1};
    }
    return json([canonical]);
  };
  const saved = await writeSiteSettings('https://example.invalid', {},1,{featured_offer:offer},request);
  assert.deepEqual(saved.categories,row.categories);
  assert.equal(saved.announcement,row.announcement);
  for (const key of ['normal-browser','fresh-incognito']) {
    assert.deepEqual((await readSiteSettings('https://example.invalid',key,request)).featured_offer,offer);
  }
});

test('unacknowledged, stale and invalid offer writes cannot claim success', async () => {
  const offer={monthly_price_try:250,description:''};
  await assert.rejects(writeSiteSettings('https://example.invalid',{},1,{featured_offer:offer},
    async()=>json([{...row,revision:2}])),/doğrulamadı/);
  await assert.rejects(writeSiteSettings('https://example.invalid',{},1,{featured_offer:offer},
    async()=>json([])),SettingsConflictError);
  await assert.rejects(writeSiteSettings('https://example.invalid',{},1,{featured_offer:{monthly_price_try:0,description:''}},
    async()=>assert.fail('Invalid offer must not reach server')));
});

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