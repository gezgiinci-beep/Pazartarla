import test from 'node:test';
import assert from 'node:assert/strict';
import {
  locationOptions, matchesLocation, matchesSearch, parseLocation, sortListings,
} from '../src/lib/locationFilter.ts';

test('parses Turkish province and district names without requesting device location', () => {
  assert.deepEqual(parseLocation('Gönen / Balıkesir'), { district: 'Gönen', province: 'Balıkesir' });
  assert.deepEqual(parseLocation('Ankara'), { district: '', province: 'Ankara' });
  assert.equal(parseLocation('Türkiye geneli'), null);
  assert.equal(matchesLocation('Konum belirtilmemiş', 'Balıkesir', ''), false);
});

test('derives district options from actual listings in the selected province', () => {
  const rows = [
    { location: 'Gönen / Balıkesir' },
    { location: 'Bandırma / Balıkesir' },
    { location: 'Çankaya / Ankara' },
    { location: 'Türkiye geneli' },
  ];
  assert.deepEqual(locationOptions(rows, 'Balıkesir').districts, ['Bandırma', 'Gönen']);
  assert.deepEqual(locationOptions(rows, '').districts, []);
  assert.equal(matchesLocation('Gönen / Balıkesir', 'Balıkesir', 'Gönen'), true);
  assert.equal(matchesLocation('Gönen / Balıkesir', 'Ankara', ''), false);
});

test('search matches listing IDs and Turkish text', () => {
  const row = { id: 47, title: 'Traktör ilanı', description: 'Gübre dağıtma ekipmanı', category: 'Makine', location: 'Gönen / Balıkesir' };
  assert.equal(matchesSearch(row, '#47'), true);
  assert.equal(matchesSearch(row, 'gübre'), true);
  assert.equal(matchesSearch(row, '48'), false);
});

test('sorting is stable by default and puts unknown prices last', () => {
  const rows = [
    { id: 1, price: 30, created_at: '2026-01-01' },
    { id: 2, price: null, created_at: '2026-03-01' },
    { id: 3, price: 10, created_at: '2026-02-01' },
  ];
  assert.deepEqual(sortListings(rows, 'default'), rows);
  assert.deepEqual(sortListings(rows, 'priceAsc').map(row => row.id), [3, 1, 2]);
  assert.deepEqual(sortListings(rows, 'priceDesc').map(row => row.id), [1, 3, 2]);
  assert.deepEqual(sortListings(rows, 'newest').map(row => row.id), [2, 3, 1]);
});
