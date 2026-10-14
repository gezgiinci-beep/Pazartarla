import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createSearchConsoleHandler } from '../api/traffic.js';
import { parseSearchConsoleReport } from '../src/lib/searchConsole.ts';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  VERCEL_ENV: 'production',
  PAZARTARLA_AUTH_BACKEND: 'turso',
  SESSION_SECRET: 's'.repeat(48),
  GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'search-console-test@example.invalid',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
};

function createResponse() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(handler, {
  method = 'GET',
  url = '/api/traffic?days=7',
  host = 'www.pazartarla.com.tr',
  origin = 'https://www.pazartarla.com.tr',
  cookie = 'session=admin',
} = {}) {
  const response = createResponse();
  await handler({ method, url, headers: { host, origin, cookie } }, response);
  return response;
}

function mockedGscRequest() {
  let analyticsCalls = 0;
  const request = async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'temporary-test-token' });
    }
    assert.match(url, /searchConsole|searchAnalytics/);
    assert.match(url, /https%3A%2F%2Fwww\.pazartarla\.com\.tr%2F/);
    assert.equal(options.method, 'POST');
    const { dimensions } = JSON.parse(options.body);
    analyticsCalls++;
    const rows = {
      date: [
        { keys: ['2026-10-10'], clicks: 2, impressions: 10, ctr: 0.2, position: 3 },
        { keys: ['2026-10-11'], clicks: 3, impressions: 10, ctr: 0.3, position: 5 },
      ],
      query: [{ keys: ['tarım makinesi'], clicks: 2, impressions: 10, ctr: 0.2, position: 3 }],
      page: [{ keys: ['https://www.pazartarla.com.tr/'], clicks: 5, impressions: 20, ctr: 0.25, position: 4 }],
      country: [{ keys: ['tur'], clicks: 5, impressions: 20, ctr: 0.25, position: 4 }],
    }[dimensions[0]];
    return Response.json({ rows });
  };
  return { request, get analyticsCalls() { return analyticsCalls; } };
}

test('Search Console endpoint returns a cached admin-only report from the Turso session', async () => {
  const gsc = mockedGscRequest();
  let sessionChecks = 0;
  const handler = createSearchConsoleHandler(env, gsc.request, () => new Date('2026-10-14T12:00:00.000Z'), {
    connect: () => ({ database: 'production-turso' }),
    getSession: async (db, req, secret) => {
      sessionChecks++;
      assert.equal(db.database, 'production-turso');
      assert.equal(secret, env.SESSION_SECRET);
      return req.headers.cookie === 'session=admin' ? { is_admin: true } : null;
    },
  });
  const first = await invoke(handler);
  assert.equal(first.code, 200);
  assert.equal(first.headers['Cache-Control'], 'private, no-store');
  assert.equal(first.body.periodDays, 7);
  assert.deepEqual(first.body.summary, { clicks: 5, impressions: 20, ctr: 25, averagePosition: 4 });
  assert.equal(first.body.daily.length, 7);
  assert.equal(first.body.daily[0].date, '2026-10-05');
  assert.equal(first.body.daily[5].clicks, 2);
  assert.equal(first.body.queries[0].query, 'tarım makinesi');
  assert.equal(parseSearchConsoleReport(first.body, 7).summary.clicks, 5);

  const second = await invoke(handler);
  assert.equal(second.code, 200);
  assert.equal(gsc.analyticsCalls, 4);
  assert.equal(sessionChecks, 2);
});

test('Search Console endpoint rejects non-admin, invalid period, wrong host, origin, and methods', async () => {
  const gsc = mockedGscRequest();
  const handler = createSearchConsoleHandler(env, gsc.request, () => new Date('2026-10-14T12:00:00.000Z'), {
    connect: () => ({}),
    getSession: async (_db, req) => req.headers.cookie === 'session=admin' ? { is_admin: true } :
      req.headers.cookie === 'session=member' ? { is_admin: false } : null,
  });
  assert.equal((await invoke(handler, { cookie: '' })).code, 401);
  assert.equal((await invoke(handler, { cookie: 'session=member' })).code, 403);
  assert.equal((await invoke(handler, { url: '/api/traffic?days=8' })).code, 400);
  assert.equal((await invoke(handler, { host: 'pazartarla.com.tr' })).code, 503);
  assert.equal((await invoke(handler, { origin: 'https://attacker.example' })).code, 403);
  assert.equal((await invoke(handler, { method: 'POST' })).code, 405);
  assert.equal(gsc.analyticsCalls, 0);
});

test('Search Console report parser rejects mismatched and malformed responses', () => {
  const valid = {
    siteUrl: 'https://www.pazartarla.com.tr/',
    periodDays: 7,
    startDate: '2026-10-05',
    endDate: '2026-10-11',
    generatedAt: '2026-10-14T12:00:00.000Z',
    summary: { clicks: 0, impressions: 0, ctr: 0, averagePosition: null },
    daily: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-${String(index + 5).padStart(2, '0')}`,
      clicks: 0, impressions: 0, ctr: 0, averagePosition: 0,
    })),
    queries: [],
    pages: [],
    countries: [],
  };
  assert.equal(parseSearchConsoleReport(valid, 7), valid);
  assert.throws(() => parseSearchConsoleReport(valid, 30));
  assert.throws(() => parseSearchConsoleReport({ ...valid, summary: { ...valid.summary, ctr: 101 } }));
  assert.throws(() => parseSearchConsoleReport({ ...valid, daily: [] }));
});
