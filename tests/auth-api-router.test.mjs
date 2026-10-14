import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAuthApiRouter } from '../server/authApiRouter.js';

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('one auth route dispatch preserves every public auth endpoint path and query', async () => {
  const actions = [
    'admin-login',
    'login',
    'logout',
    'session',
    'request-password-reset',
    'resend-verification',
    'reset-password',
    'signup',
    'verify-email',
  ];
  const calls = [];
  const handlers = Object.fromEntries(actions.map(action => [
    action,
    async (request, response) => {
      calls.push({ action, url: request.url });
      return response.status(200).json({ action });
    },
  ]));
  const route = createAuthApiRouter(handlers);

  for (const action of actions) {
    const response = responseMock();
    await route({ url: `/api/auth/${action}?return=home`, method: 'POST' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.action, action);
  }

  assert.equal(calls.length, actions.length);
  assert.equal(calls.at(-1).url, '/api/auth/verify-email?return=home');
});

test('unknown or nested paths cannot fall through to an auth handler', async () => {
  const route = createAuthApiRouter({ login: async (_request, response) => response.status(200).json({}) });
  for (const url of ['/api/auth/unknown', '/api/auth/login/extra', '/api/other/login']) {
    const response = responseMock();
    await route({ url, method: 'GET' }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error, 'not_found');
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
});

test('Vercel rewrites auth paths to the consolidated function before SPA fallback', async () => {
  const configPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const routes = config.routes;
  const authIndex = routes.findIndex(route =>
    route.src === '/api/auth/(.*)' && route.dest === '/api/auth-router?action=$1');
  const filesystemIndex = routes.findIndex(route => route.handle === 'filesystem');
  assert.ok(authIndex >= 0);
  assert.ok(filesystemIndex > authIndex);
});

test('consolidated Vercel function dispatches the rewritten auth action query', async () => {
  const calls = [];
  const route = createAuthApiRouter({
    login: async (_request, response) => {
      calls.push('login');
      return response.status(200).json({ ok: true });
    },
  });
  const response = responseMock();
  await route({ url: '/api/auth-router?action=login', query: { action: 'login' }, method: 'POST' }, response);
  assert.deepEqual(calls, ['login']);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
});
