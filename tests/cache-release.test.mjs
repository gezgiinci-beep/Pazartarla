import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReleaseMetadata, releaseMetadataPlugin } from '../build/releaseMetadata.mjs';
import { createReleaseChecker, isNewRelease } from '../src/lib/releaseRefresh.js';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
function headersFor(path) {
  const headers = {};
  for (const route of config.routes) {
    if (route.handle === 'filesystem') break;
    if (route.src && new RegExp('^' + route.src + '$').test(path)) Object.assign(headers, route.headers);
  }
  return headers;
}
test('HTML, SPA entries, version metadata and APIs are not stored by browser or CDN', () => {
  for (const path of ['/', '/index.html', '/version.json', '/ilan/123', '/api/traffic', '/assets/logo.svg']) {
    const headers = headersFor(path);
    assert.match(headers['Cache-Control'], /no-store/);
    assert.equal(headers['CDN-Cache-Control'], 'no-store');
    assert.equal(headers['Vercel-CDN-Cache-Control'], 'no-store');
  }
  assert.equal(config.headers, undefined, 'legacy routes cannot be mixed with top-level headers');
});
test('only fingerprinted assets get long-lived immutable caching', () => {
  for (const path of ['/assets/index-CE02ytIz.js', '/assets/index-4_ti2aBU.css', '/assets/photo-ABCDEFGH.webp']) {
    assert.equal(headersFor(path)['Cache-Control'], 'public, max-age=31536000, immutable');
    assert.equal(headersFor(path)['Vercel-CDN-Cache-Control'], 'public, max-age=31536000, immutable');
  }
  assert.match(headersFor('/assets/script.js')['Cache-Control'], /no-store/);
});
test('release stamp exports only public metadata and changes for every rebuild', () => {
  const env = { VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), SECRET: 'must-not-leak' };
  const first = createReleaseMetadata(env, new Date('2026-10-04T12:00:00.000Z'));
  const second = createReleaseMetadata(env, new Date('2026-10-04T12:00:00.001Z'));
  assert.notEqual(first.id, second.id);
  assert.equal(first.revision, 'a'.repeat(40));
  assert.doesNotMatch(JSON.stringify(first), /must-not-leak|SECRET/);
  assert.equal(createReleaseMetadata({ VERCEL_GIT_COMMIT_SHA: '<script>' }).revision, 'local');
});
test('HTML, client bundle and version manifest use the same stamp', () => {
  const plugin = releaseMetadataPlugin({ env: {}, now: new Date('2026-10-04T12:00:00.000Z') });
  const id = JSON.parse(plugin.config().define.__PAZARTARLA_BUILD_ID__);
  assert.equal(plugin.transformIndexHtml()[0].attrs.content, id);
  let output;
  plugin.generateBundle.call({ emitFile: value => { output = value; } }, {}, { 'assets/index-ABCDEFGH.js': {} });
  assert.equal(output.fileName, 'version.json');
  assert.equal(JSON.parse(output.source).id, id);
  assert.deepEqual(JSON.parse(output.source).assets, ['assets/index-ABCDEFGH.js']);
});
test('new releases notify once; malformed and identical manifests do not trigger refresh', async () => {
  const old = 'local-20261004120000000', next = 'local-20261004120000001';
  assert.equal(isNewRelease(old, { id: old }), false);
  assert.equal(isNewRelease(old, { id: '<script>' }), false);
  let notifications = 0;
  const check = createReleaseChecker(old, async () => ({ id: next }), () => notifications++);
  assert.equal(await check(), true);
  assert.equal(await check(), false);
  assert.equal(notifications, 1);
});
test('failed checks can recover and simultaneous events share one check', async () => {
  let calls = 0, resolve;
  const check = createReleaseChecker('local-20261004120000000', async () => {
    calls++;
    if (calls === 1) throw Error('offline');
    return new Promise(done => { resolve = done; });
  }, () => {});
  assert.equal(await check(), false);
  const pending = check();
  assert.equal(await check(), false);
  resolve({ id: 'local-20261004120000001' });
  assert.equal(await pending, true);
  assert.equal(calls, 2);
});
test('bootstrap uses the artifact base path and never forces a draft-destroying reload', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/lib/releaseRefresh.js', import.meta.url), 'utf8');
  assert.match(main, /startReleaseRefresh\(import\.meta\.env\.BASE_URL, __PAZARTARLA_BUILD_ID__\)/);
  assert.match(client, /cache: 'no-store'/);
  assert.match(client, /button\.addEventListener\('click', \(\) => window\.location\.reload\(\)\)/);
  assert.equal((client.match(/location\.reload/g) || []).length, 1);
});