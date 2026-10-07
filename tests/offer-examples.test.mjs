import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/OfferMarketplace.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
  plugins: [{ name: 'css', setup(b) {
    b.onResolve({ filter: /\.css$/ }, a => ({ path: a.path, namespace: 'css' }));
    b.onLoad({ filter: /.*/, namespace: 'css' }, () => ({ contents: '', loader: 'js' }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const Marketplace = module.exports.default;
let writes = 0;
const noWrite = async () => { writes++; return false; };
const base = { catalogIds: [], ownerIds: [], settings: {}, offers: [], messages: [],
  loading: false, busy: false, error: '', actionError: '',
  refresh: noWrite, toggle: noWrite, submit: noWrite, respond: noWrite, sendMessage: noWrite };
const render = (state = base, listings = []) => renderToStaticMarkup(React.createElement(Marketplace, {
  state, listings, ownListings: [], session: null,
  onOpenListing: noWrite, onSignIn: noWrite, onCreateListing: noWrite, onBack: noWrite,
}));
const count = html => (html.match(/data-testid="offer-example-demo-offer-/g) || []).length;

test('all eight requested illustrated examples appear in the actual public offer component', () => {
  const html = render();
  assert.equal(count(html), 8);
  for (const title of ['Traktör — 75 HP', 'Ekmeklik buğday', 'Sera domatesi', 'Sızma zeytinyağı',
    'Balya makinesi', 'Ceviz fidanı', 'Yonca balyası', 'Patates — çuvallı']) assert(html.includes(title));
  assert.equal((html.match(/data:image\/svg\+xml/g) || []).length, 8);
  assert.equal((html.match(/>Demo \/ Örnek</g) || []).length, 8);
  assert.match(html, /gerçek satıcı, stok veya teklif değildir/);
});

test('illustrative examples do not hide real loading or backend errors', () => {
  const loading = render({ ...base, loading: true });
  assert.equal(count(loading), 8);
  assert.match(loading, /Yükleniyor/);
  const error = render({ ...base, error: 'Gerçek servis kullanılamıyor' });
  assert.equal(count(error), 8);
  assert.match(error, /Gerçek servis kullanılamıyor/);
});

test('real catalog filtering and real listing cards remain independent', () => {
  const html = render({ ...base, catalogIds: [42] }, [
    { id: 42, title: 'Gerçek onaylı ilan', price: 100 },
    { id: 43, title: 'Teklife kapalı ilan', price: 200 },
  ]);
  assert.match(html, /data-testid="card-offer-listing-42"/);
  assert.doesNotMatch(html, /data-testid="card-offer-listing-43"/);
  assert.equal(count(html), 8);
});

test('demo implementation cannot send offers, contact sellers, or write database data', () => {
  const source = readFileSync(new URL('../src/components/OfferExamples.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /supabase|\.rpc\(|onOpenListing|state\.submit|state\.respond|fetch\(|tel:|wa\.me/);
  assert.match(source, /disabled>Örnek ilan — teklif gönderilemez/);
  assert.match(source, /onClose=/);
  assert.match(source, /previousFocus\.current\?\.focus/);
  assert.equal(writes, 0);
  const marketplace = readFileSync(new URL('../src/components/OfferMarketplace.tsx', import.meta.url), 'utf8');
  assert(marketplace.indexOf('<OfferExamples />') < marketplace.indexOf("{tab === 'mine' && ("));
});
