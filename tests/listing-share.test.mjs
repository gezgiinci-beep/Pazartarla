import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { listingIdFromUrl, listingShareUrl, listingShareText, findSharedListing } from '../src/lib/listingShare.ts';

test('sharing uses the public www site and only the listing identifier', () => {
  const url = listingShareUrl(123);
  assert.equal(url, 'https://www.pazartarla.com.tr/?ilan=123');
  assert.equal(listingIdFromUrl(url), '123');
  assert.equal(listingIdFromUrl('https://preview.invalid/pazartarla/?ilan=123&magaza=private'), '123');
});
test('text shared through messaging or copied includes a complete clickable URL', () => {
  const text = listingShareText({ id: 42, title: 'Ceviz & badem', price: 1500, location: 'İzmir' });
  assert.ok(text.includes('https://www.pazartarla.com.tr/?ilan=42'));
  assert.ok(text.includes('1.500 TL'));
  const whatsapp = new URL('https://api.whatsapp.com/send?text=' + encodeURIComponent(text));
  assert.equal(whatsapp.searchParams.get('text'), text);
});
test('invalid or missing identifiers never create an unsafe link', () => {
  for (const id of [null, undefined, '', 'x&magaza=private', '<script>', 'a'.repeat(129)]) {
    assert.throws(() => listingShareUrl(id));
  }
  assert.equal(listingIdFromUrl('invalid'), null);
  assert.equal(listingIdFromUrl('https://www.pazartarla.com.tr/'), null);
  assert.equal(listingIdFromUrl('https://www.pazartarla.com.tr/?ilan=%3Cscript%3E'), null);
});
test('a direct link resolves the exact approved listing, not private or missing records', () => {
  const rows = [{ id: 42, status: 'approved' }, { id: 43, status: 'pending' }];
  assert.equal(findSharedListing(rows, '42'), rows[0]);
  assert.equal(findSharedListing(rows, '43'), null);
  assert.equal(findSharedListing(rows, '999'), null);
});
test('all sharing controls and direct-entry navigation are wired to the same listing URL', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('encodeURIComponent(listingShareText(selectedListing))'));
  assert.ok(source.includes('encodeURIComponent(listingShareUrl(selectedListing.id))'));
  assert.ok(source.includes('findSharedListing(listings, linkedListingId)'));
  assert.ok(source.includes('await navigator.clipboard.writeText(text)'));
  assert.ok(source.includes('Bağlantıyı kopyala'));
  assert.ok(source.includes('Paylaşılan ilan bulunamadı'));
});

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
test('direct-entry waits for loading and then opens the exact approved listing', () => {
  const effect = source.match(/  useEffect\(\(\)=>\{\n    if\(!linkedListingId[\s\S]*?\},\[linkedListingId,listings,listingsLoading,listingsError\]\);/)?.[0];
  assert.ok(effect);
  const approved = { id: 42, status: 'approved' };
  const context = {
    useEffect: callback => callback(), linkedListingId: '42',
    listings: [approved], listingsLoading: true, listingsError: '',
    findSharedListing, setSelectedListing: value => { context.selected = value; },
    selected: 'unchanged',
  };
  runInNewContext(effect, context);
  assert.equal(context.selected, 'unchanged');
  context.listingsLoading = false;
  runInNewContext(effect, context);
  assert.equal(context.selected, approved);
  context.linkedListingId = '999';
  runInNewContext(effect, context);
  assert.equal(context.selected, null);
});
test('opening another listing updates the URL and clears the old incoming link/store', () => {
  const open = source.match(/  const openListing=\(row\)=>\{[\s\S]*?\n  \};/)?.[0];
  assert.ok(open);
  const state = {};
  const context = {
    URL, row: { id: 43, status: 'approved' },
    window: { location: { href: 'https://preview.invalid/pazartarla/?ilan=42&magaza=old' },
      history: { pushState: (value, title, url) => { state.history = value; state.url = new URL(url); } } },
    setLinkedListingId: value => { state.linked = value; },
    setStoreId: value => { state.store = value; },
    setSelectedListing: value => { state.selected = value; },
    setPhotoCopyMessage: () => {},
    setPhotoCopyError: () => {},
    setActiveTab: value => { state.tab = value; },
  };
  runInNewContext(open + '\nopenListing(row);', context);
  assert.equal(state.url.pathname, '/pazartarla/');
  assert.equal(state.url.searchParams.get('ilan'), '43');
  assert.equal(state.url.searchParams.has('magaza'), false);
  assert.equal(state.linked, null);
  assert.equal(state.store, null);
  assert.equal(state.tab, 'detail');
  assert.equal(state.selected, context.row);
});
test('browser back/forward restores the requested listing and does not reuse the old detail', () => {
  const effect = source.match(/  useEffect\(\(\) => \{\n    window.history.replaceState[\s\S]*?\n  \}, \[\]\);/)?.[0];
  assert.ok(effect);
  const state = {};
  let pop;
  const context = {
    listingIdFromUrl, storeIdFromUrl: () => null,
    useEffect: callback => callback(),
    window: { location: { href: 'https://www.pazartarla.com.tr/?ilan=42' },
      history: { replaceState() {} },
      addEventListener: (name, callback) => { if (name === 'popstate') pop = callback; },
      removeEventListener() {} },
    setLinkedListingId: value => { state.id = value; },
    setSelectedListing: value => { state.selected = value; },
    setPhotoCopyMessage: () => {},
    setPhotoCopyError: () => {},
    setActiveTab: value => { state.tab = value; },
  };
  runInNewContext(effect, context);
  pop({ state: { tab: 'detail' } });
  assert.equal(state.id, '42');
  assert.equal(state.tab, 'detail');
  assert.equal(state.selected, null);
  context.window.location.href = 'https://www.pazartarla.com.tr/';
  pop({ state: { tab: 'home' } });
  assert.equal(state.id, null);
  assert.equal(state.tab, 'home');
});
