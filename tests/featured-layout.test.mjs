import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { formatListingDate } from '../src/lib/listingLifetime.ts';

// Compile the actual featured-listings JSX, not a second implementation.
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const start = source.indexOf('{featuredListings.length > 0 && (');
const end = source.indexOf("\n            <div style={{ backgroundColor: '#fff', borderRadius: '12px'", start);
assert.ok(start > 0 && end > start, 'Featured section must exist');
const expression = source.slice(start, end).trim().slice(1, -1);
const compiled = await transformWithEsbuild(
  `function Featured({featuredListings,setSelectedListing,changeTab}) { return (${expression}); }`,
  'featured-fixture.tsx',
  { jsx: 'transform', jsxFactory: 'React.createElement' }
);
const dateStart = source.indexOf('const ListingDate =');
const dateEnd = source.indexOf('const normalizeListing', dateStart);
const dateComponent = await transformWithEsbuild(
  source.slice(dateStart, dateEnd).replace('const ListingDate =', 'var ListingDate ='),
  'listing-date-fixture.tsx', { jsx: 'transform', jsxFactory: 'React.createElement' }
);
const context = { React, Star: () => null, formatListingDate };
runInNewContext(dateComponent.code, context);
runInNewContext(compiled.code, context);
const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#d1fae5"/><path d="M0 95L65 35L110 80L150 40L200 100V120H0Z" fill="#166534"/></svg>');
const render = count => renderToStaticMarkup(React.createElement(context.Featured, {
  featuredListings: Array.from({ length: count }, (_, i) => ({
    id: i + 1, title: `Vitrin ilanı ${i + 1}`, images: [photo], price: (i + 1) * 1000, created_at: '2026-10-04T00:00:00Z'
  })),
  setSelectedListing() {}, changeTab() {}
}));

test('six featured listings render in a three-column grid without a horizontal carousel', () => {
  const html = render(6);
  assert.match(html, /display:grid;grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/);
  assert.equal((html.match(/<img /g) || []).length, 6);
  for (let i = 1; i <= 6; i++) assert.ok(html.includes(`alt="Vitrin ilanı ${i}"`));
  assert.doesNotMatch(html, /overflow-x:auto|min-width:160px|max-width:160px/);
  assert.equal((html.match(/min-width:0;box-sizing:border-box/g) || []).length, 6);
  assert.equal((html.match(/04\.10\.2026/g) || []).length, 6);
});
test('additional featured listings are not truncated and empty state stays empty', () => {
  assert.equal((render(7).match(/<img /g) || []).length, 7);
  assert.equal(render(0), '');
});

// Optional, isolated visual fixture; no database records or app data are changed.
const outputIndex = process.argv.indexOf('--render-output');
if (outputIndex !== -1) {
  const path = process.argv[outputIndex + 1];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vitrin yerleşim kontrolü</title><body style="margin:0;background:#f4f6f8;font-family:system-ui,sans-serif"><main style="width:100%;max-width:600px;margin:0 auto;padding:12px;box-sizing:border-box">${render(6)}</main></body></html>`);
}