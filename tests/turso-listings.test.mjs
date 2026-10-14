import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createPublicListingsHandler } from '../api/public-listings.js';
import { createListingMetadataHandler } from '../api/listing-metadata.js';
import { readPublicListingsFromTurso } from '../server/publicListings.js';
import { readPublicAdvertisementsFromTurso } from '../server/publicAdvertisements.js';
import { getTursoConfiguration } from '../server/turso.js';
import { readListingSeoFromApi, readPublicListingsFromApi } from '../src/lib/tursoListings.mjs';

const schema = await readFile(
  new URL('../database/turso-migrations/0001_core.sql', import.meta.url),
  'utf8',
);

test('core Turso schema creates durable business tables and preserves legacy listing columns', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(schema);
    const columns = database.prepare("PRAGMA table_info('listings')").all();
    const columnNames = new Set(columns.map(column => column.name));
    for (const required of [
      'id', 'title', 'price', 'category', 'subCategory', 'phone', 'image',
      'seotags', 'status', 'created_at', 'expires_at', 'submitted_by',
      'is_featured', 'gallery_paths',
    ]) assert.ok(columnNames.has(required), `missing listing field: ${required}`);

    database.prepare(`
      INSERT INTO listings (title, price, category, seller, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Test listing', '12.50', 'Mahsuller', 'Synthetic', '0000000000',
      'approved', '2026-10-13T10:00:00.000Z');
    assert.equal(database.prepare('SELECT count(*) AS count FROM listings').get().count, 1);
  } finally {
    database.close();
  }
});

test('Turso configuration accepts hosted Turso URLs without exposing tokens', () => {
  const config = getTursoConfiguration({
    NODE_ENV: 'production',
    TURSO_DATABASE_URL: 'libsql://market-tenant.turso.io',
    TURSO_AUTH_TOKEN: 'test-only-token',
  });
  assert.equal(config.url, 'libsql://market-tenant.turso.io');
  assert.equal(config.authToken, 'test-only-token');
  assert.equal(config.defaultQueryTimeout, 8000);
});

test('Turso configuration rejects missing credentials and non-Turso public endpoints', () => {
  assert.throws(
    () => getTursoConfiguration({ NODE_ENV: 'production' }),
    error => error.code === 'TURSO_NOT_CONFIGURED',
  );
  assert.throws(
    () => getTursoConfiguration({
      NODE_ENV: 'production',
      TURSO_DATABASE_URL: 'https://example.com',
      TURSO_AUTH_TOKEN: 'test-only-token',
    }),
    error => error.code === 'TURSO_CONFIGURATION_INVALID',
  );
});

test('Turso migration-test database is accepted for preview but blocked in Vercel production', () => {
  const credentials = {
    NODE_ENV: 'production',
    TURSO_DATABASE_URL: 'libsql://pazartarla-migration-test-pazartarla.aws-eu-north-1.turso.io',
    TURSO_AUTH_TOKEN: 'test-only-token',
  };
  assert.doesNotThrow(() => getTursoConfiguration({ ...credentials, VERCEL_ENV: 'preview' }));
  assert.throws(
    () => getTursoConfiguration({ ...credentials, VERCEL_ENV: 'production' }),
    error => error.code === 'TURSO_TEST_DATABASE_FORBIDDEN',
  );
});

test('public inventory never loads oversized legacy SEO metadata with the initial listing payload', async () => {
  const calls = [];
  const database = {
    async all(sql, ...args) {
      calls.push({ sql, args });
      if (sql.includes('FROM listings') && sql.includes('ORDER BY')) {
        assert.match(sql, /WHERE status = \?/);
        assert.doesNotMatch(sql, /seotags/);
        return [
          {
            id: 2, title: 'New', price: '15.5', category: 'Mahsuller',
            subCategory: 'Ceviz', phone: '0000000000', status: 'approved',
            is_featured: 1, gallery_paths: '["photo-1"]',
          },
          {
            id: 1, title: 'Legacy', price: '8', category: 'Mahsuller',
            phone: '0000000000', status: 'approved',
            is_featured: null, gallery_paths: null,
          },
        ];
      }
      assert.fail(`unexpected compatibility query: ${sql}`);
    },
  };

  const rows = await readPublicListingsFromTurso(database);
  assert.equal(calls.length, 1);
  assert.equal(rows[0].price, 15.5);
  assert.equal(rows[0].is_featured, true);
  assert.deepEqual(rows[0].gallery_paths, ['photo-1']);
  assert.equal(Object.hasOwn(rows[0], 'seotags'), false);
  assert.equal(Object.hasOwn(rows[1], 'seotags'), false);
});

test('public advertisement reader selects only approved live sponsor cards and normalizes SQLite booleans', async () => {
  let sql = '';
  const database = {
    async all(statement) {
      sql = statement;
      return [{
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Sponsor',
        target_url: null,
        media_path: '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.jpg',
        media_type: 'image',
        is_active: 1,
        revision: 2,
        created_at: '2026-10-13T10:00:00.000Z',
      }];
    },
  };
  const rows = await readPublicAdvertisementsFromTurso(database);
  assert.match(sql, /WHERE is_active = 1/);
  assert.match(sql, /LIMIT 100/);
  assert.equal(rows[0].is_active, true);
  assert.equal(rows[0].revision, 2);
  assert.equal(rows[0].title, 'Sponsor');
});

test('public listings endpoint is GET-only and never leaks connection errors', async () => {
  const handler = createPublicListingsHandler({
    connect() {
      const error = new Error('private connection detail');
      error.code = 'TURSO_NOT_CONFIGURED';
      throw error;
    },
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await handler({ method: 'POST' }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');

  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'database_not_configured' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.stringify(response.body).includes('private connection detail'), false);
});

test('public listings endpoint preserves only 402/429 retry metadata and never leaks upstream details', async () => {
  for (const status of [402, 429]) {
    const handler = createPublicListingsHandler({
      connect() {
        const error = new Error('private upstream detail');
        error.status = status;
        error.retryAfterMs = 45_001;
        throw error;
      },
    });
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ method: 'GET' }, response);
    assert.equal(response.statusCode, status);
    assert.equal(response.headers['Retry-After'], '46');
    assert.deepEqual(response.body, { error: 'database_unavailable' });
    assert.equal(JSON.stringify(response.body).includes('private upstream detail'), false);
  }
});

test('public listings endpoint serves ads from Turso on the existing function and rejects unknown resources', async () => {
  const calls = [];
  const handler = createPublicListingsHandler({
    connect() { return { id: 'connected' }; },
    async readAdvertisements(database) {
      calls.push(database);
      return [{ id: 'sponsor-1' }];
    },
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'GET', query: { resource: 'advertisements' } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { advertisements: [{ id: 'sponsor-1' }] });
  assert.equal(calls[0].id, 'connected');

  await handler({ method: 'GET', url: '/api/public-listings?resource=unknown' }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'resource_not_found' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('single-listing SEO endpoint validates IDs and serves only approved public records', async () => {
  const calls = [];
  const handler = createListingMetadataHandler({
    connect() {
      return {
        async get(sql, ...args) {
          calls.push({ sql, args });
          return args[0] === 8 ? { seotags: 'public SEO' } : null;
        },
      };
    },
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await handler({ method: 'GET', query: { id: '08' } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { seotags: 'public SEO' });
  assert.match(calls[0].sql, /status = \?/);
  assert.deepEqual(calls[0].args, [8, 'approved']);

  await handler({ method: 'GET', query: { id: '0' } }, response);
  assert.equal(response.statusCode, 400);
  await handler({ method: 'GET', query: { id: '8 OR 1=1' } }, response);
  assert.equal(response.statusCode, 400);
  await handler({ method: 'GET', query: { id: '9' } }, response);
  assert.equal(response.statusCode, 404);
});

test('single-listing SEO endpoint drops legacy blobs instead of returning multi-megabyte page metadata', async () => {
  const handler = createListingMetadataHandler({
    connect() {
      return { async get() { return { seotags: `data:image/jpeg;base64,${'x'.repeat(10_000)}` }; } };
    },
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'GET', query: { id: '157' } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { seotags: null });
});

test('frontend Turso listing helpers validate server responses and encode metadata IDs', async () => {
  const publicListings = await readPublicListingsFromApi(async path => {
    assert.equal(path, '/api/public-listings');
    return { ok: true, json: async () => ({ listings: [{ id: 4 }] }) };
  });
  assert.deepEqual(publicListings, [{ id: 4 }]);

  let requestedPath = '';
  const seo = await readListingSeoFromApi(4, async path => {
    requestedPath = path;
    return { ok: true, json: async () => ({ seotags: null }) };
  });
  assert.equal(seo, null);
  assert.equal(requestedPath, '/api/listing-metadata?id=4');
  await assert.rejects(() => readListingSeoFromApi('1 OR 1=1', async () => {
    throw new Error('invalid ID must not be requested');
  }), /İlan kimliği geçersiz/);
});

test('Turso public listing 402 response exposes Retry-After to the page backoff', async () => {
  await assert.rejects(
    readPublicListingsFromApi(async (path, options) => {
      assert.equal(path, '/api/public-listings');
      assert.equal(options.cache, 'no-store');
      return new Response('{}', { status: 402, headers: { 'retry-after': '240' } });
    }),
    error => error.status === 402 && error.retryAfterMs === 240_000,
  );
});
