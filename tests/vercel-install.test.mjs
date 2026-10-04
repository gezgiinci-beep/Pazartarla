import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('standalone Vercel checkout uses pnpm and its frozen, isolated lockfile', () => {
  assert.equal(manifest.packageManager, 'pnpm@10.26.1');
  assert.equal(config.installCommand, 'pnpm install --frozen-lockfile --ignore-workspace');
  assert.equal(config.buildCommand, 'pnpm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.framework, 'vite');
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      assert.doesNotMatch(version, /^(workspace|catalog):/, `${name} must resolve in a standalone checkout`);
    }
  }
});

test('existing traffic cron and SPA fallback remain configured', () => {
  assert.deepEqual(config.crons, [{ path: '/api/traffic', schedule: '0 0 * * *' }]);
  assert.deepEqual(config.routes, [
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ]);
});