import assert from 'node:assert/strict';
import test from 'node:test';
import {createVercelApiRouter} from '../server/vercelApiRouter.js';

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

test('all public API paths map to their existing handlers through one function', async () => {
  const paths = [
    'advertisement-media-delete',
    'advertisement-media',
    'advertisements',
    'auth-router',
    'contact-depot',
    'contact-depot-unsubscribe',
    'listing-archive',
    'listing-media',
    'listing-metadata',
    'listing-moderation',
    'listing-owner',
    'offers',
    'public-listings',
    'site-settings',
    'store-membership-data',
    'store-membership/mutate',
    'store-membership/publication',
    'submissions',
    'traffic',
  ];
  const calls = [];
  const handlers = Object.fromEntries(paths.map(path => [
    path,
    async (request, response) => {
      calls.push({path, url: request.url});
      return response.status(200).json({path});
    },
  ]));
  const route = createVercelApiRouter(handlers);

  for (const path of paths) {
    const response = responseMock();
    await route({url: '/api/index', query: {__route: path}, method: 'GET'}, response);
    assert.equal(response.statusCode, 200, path);
    assert.equal(response.body.path, path);
  }

  const authResponse = responseMock();
  await route({
    url: '/api/index',
    query: {__route: 'auth/login', return: 'home'},
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: {email: 'seller@example.invalid'},
  }, authResponse);
  assert.equal(authResponse.statusCode, 200);
  assert.deepEqual(calls.at(-1), {path: 'auth-router', url: '/api/auth/login?return=home'});
});

test('reconstructs endpoint URLs and preserves repeated query values', async () => {
  let received;
  const route = createVercelApiRouter({
    'listing-owner': async (request, response) => {
      received = {url: request.url, query: request.query};
      return response.status(200).json({ok: true});
    },
  });
  const response = responseMock();
  await route({
    url: '/api/index',
    query: {__route: 'listing-owner', id: 'listing-1', label: ['a', 'b']},
    method: 'GET',
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(received.url, '/api/listing-owner?id=listing-1&label=a&label=b');
  assert.deepEqual(received.query, {id: 'listing-1', label: ['a', 'b']});
});

test('parses JSON when the shared function disables Vercel body parsing', async () => {
  const route = createVercelApiRouter({
    submissions: async (request, response) =>
      response.status(200).json({body: request.body}),
  });
  const payload = JSON.stringify({title: 'Test listing'});
  const request = {
    url: '/api/index',
    query: {__route: 'submissions'},
    method: 'POST',
    headers: {'content-type': 'application/json'},
    async *[Symbol.asyncIterator]() { yield Buffer.from(payload); },
  };
  const response = responseMock();
  await route(request, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.body, {title: 'Test listing'});
});

test('leaves raw media request streams untouched', async () => {
  let bytes = 0;
  const route = createVercelApiRouter({
    'listing-media': async (request, response) => {
      for await (const chunk of request) bytes += chunk.length;
      return response.status(201).json({uploaded: true});
    },
  });
  const response = responseMock();
  await route({
    url: '/api/index',
    query: {__route: 'listing-media'},
    method: 'POST',
    headers: {'content-type': 'image/webp'},
    async *[Symbol.asyncIterator]() { yield Buffer.from([1, 2, 3]); },
  }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(bytes, 3);
});

test('rejects oversized or malformed JSON and unknown routes without falling through', async () => {
  const route = createVercelApiRouter({submissions: async () => assert.fail('must not run')});
  const tooLarge = responseMock();
  await route({
    url: '/api/index',
    query: {__route: 'submissions'},
    method: 'POST',
    headers: {'content-type': 'application/json', 'content-length': String(3 * 1024 * 1024)},
  }, tooLarge);
  assert.equal(tooLarge.statusCode, 413);
  const malformed = responseMock();
  await route({
    url: '/api/index',
    query: {__route: 'submissions'},
    method: 'POST',
    headers: {'content-type': 'application/json'},
    async *[Symbol.asyncIterator]() { yield Buffer.from('{'); },
  }, malformed);
  assert.equal(malformed.statusCode, 400);
  const missing = responseMock();
  await route({url: '/api/index', query: {__route: '../index'}, method: 'GET'}, missing);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers['Cache-Control'], 'no-store');
});
