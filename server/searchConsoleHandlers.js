import { createSign } from 'node:crypto';
import { createTursoConnection } from './turso.js';
import { getAuthSession } from './tursoAuth.js';

const SITE_URL = 'https://www.pazartarla.com.tr/';
const SEARCH_ANALYTICS_URL = 'https://searchconsole.googleapis.com/webmasters/v3/sites/';
const DAY_MS = 24 * 60 * 60 * 1000;
const reportCache = new Map();
let cachedGoogleToken = null;

function header(request, name) {
  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function send(response, status, body) {
  return response.status(status).json(body);
}

function parseJson(response) {
  return response.json().catch(() => null);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(days, now) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * DAY_MS);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

function metric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeRows(rows, dimension, days, startDate) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const key = Array.isArray(row?.keys) ? row.keys[0] : null;
    if (typeof key !== 'string' || !key || !/^\d{4}-\d{2}-\d{2}$/.test(key) && dimension === 'date') return [];
    const clicks = metric(row.clicks);
    const impressions = metric(row.impressions);
    const ctr = impressions > 0 ? clicks / impressions * 100 : 0;
    const position = impressions > 0 ? metric(row.position) : 0;
    return [{
      key,
      clicks,
      impressions,
      ctr,
      position,
    }];
  }).slice(0, dimension === 'date' ? days : 20);
}

function buildReport({ days, dateRows, queryRows, pageRows, countryRows, startDate, endDate, generatedAt }) {
  const dateMap = new Map(normalizeRows(dateRows, 'date', days, startDate).map(row => [row.key, row]));
  const daily = Array.from({ length: days }, (_, index) => {
    const date = isoDay(new Date(Date.parse(`${startDate}T00:00:00Z`) + index * DAY_MS));
    const row = dateMap.get(date);
    return {
      date,
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      ctr: row?.ctr ?? 0,
      averagePosition: row?.position ?? 0,
    };
  });
  const clicks = daily.reduce((total, row) => total + row.clicks, 0);
  const impressions = daily.reduce((total, row) => total + row.impressions, 0);
  const weightedPosition = daily.reduce((total, row) => total + row.averagePosition * row.impressions, 0);
  const ranked = (rows, dimension) => normalizeRows(rows, dimension, days, startDate)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.key.localeCompare(b.key))
    .slice(0, 10)
    .map(row => ({
      [dimension === 'query' ? 'query' : dimension === 'page' ? 'page' : 'country']: row.key,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      averagePosition: row.position,
    }));

  return {
    siteUrl: SITE_URL,
    periodDays: days,
    startDate,
    endDate,
    generatedAt,
    summary: {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions * 100 : 0,
      averagePosition: impressions > 0 ? weightedPosition / impressions : null,
    },
    daily,
    queries: ranked(queryRows, 'query'),
    pages: ranked(pageRows, 'page'),
    countries: ranked(countryRows, 'country').map(row => ({ ...row, country: row.country.toUpperCase() })),
  };
}

function createAssertion(credentials, nowSeconds) {
  if (typeof credentials?.client_email !== 'string' || !credentials.client_email ||
      typeof credentials?.private_key !== 'string' || !credentials.private_key) {
    throw new Error('Invalid Search Console credentials');
  }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(credentials.private_key.replace(/\\n/g, '\n')).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function googleAccessToken(env, request) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now()) return cachedGoogleToken.value;
  let credentials;
  try {
    credentials = JSON.parse(env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT || '');
  } catch {
    throw new Error('Search Console credentials are unavailable');
  }
  const assertion = createAssertion(credentials, Math.floor(Date.now() / 1000));
  const tokenResponse = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenBody = await parseJson(tokenResponse);
  if (!tokenResponse.ok || typeof tokenBody?.access_token !== 'string') {
    throw new Error('Search Console token request failed');
  }
  cachedGoogleToken = { value: tokenBody.access_token, expiresAt: Date.now() + 50 * 60_000 };
  return cachedGoogleToken.value;
}

async function verifyAdmin(req, env, connect, getSession, currentTime) {
  if (env.PAZARTARLA_AUTH_BACKEND !== 'turso') {
    return { status: 503, error: 'auth_unavailable' };
  }
  const secret = env.SESSION_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    return { status: 503, error: 'auth_unavailable' };
  }
  try {
    const session = await getSession(connect(), req, secret, currentTime);
    if (!session) return { status: 401, error: 'admin_session_required' };
    if (session.is_admin !== true) return { status: 403, error: 'admin_required' };
    return { status: 200 };
  } catch {
    return { status: 503, error: 'auth_unavailable' };
  }
}

export function createSearchConsoleHandler(env = process.env, request = fetch, now = () => new Date(), {
  connect = createTursoConnection,
  getSession = getAuthSession,
} = {}) {
  return async function searchConsoleHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(res, 405, { error: 'method_not_allowed' });
    }

    const host = String(header(req, 'x-forwarded-host') || header(req, 'host') || '')
      .split(',')[0].trim().toLowerCase();
    if (env.VERCEL_ENV !== 'production' || host !== 'www.pazartarla.com.tr') {
      return send(res, 503, { error: 'search_console_disabled_outside_www_production' });
    }
    const origin = header(req, 'origin');
    if (origin) {
      try {
        if (new URL(origin).origin !== 'https://www.pazartarla.com.tr') {
          return send(res, 403, { error: 'origin_denied' });
        }
      } catch {
        return send(res, 403, { error: 'origin_denied' });
      }
    }

    let days;
    try {
      const url = new URL(req.url || '/api/traffic', 'https://www.pazartarla.com.tr');
      days = Number(url.searchParams.get('days') || '7');
    } catch {
      days = 0;
    }
    if (![7, 30, 90].includes(days)) return send(res, 400, { error: 'invalid_period' });

    const auth = await verifyAdmin(req, env, connect, getSession, now());
    if (auth.status !== 200) return send(res, auth.status, { error: auth.error });

    const currentDate = now();
    const { startDate, endDate } = getDateRange(days, currentDate);
    const cacheKey = `${startDate}:${endDate}`;
    const cached = reportCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return send(res, 200, cached.report);

    try {
      const accessToken = await googleAccessToken(env, request);
      const endpoint = `${SEARCH_ANALYTICS_URL}${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;
      const query = async (dimension, rowLimit) => {
        const response = await request(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, dimensions: [dimension], rowLimit }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error('Search Console query failed');
        const payload = await parseJson(response);
        if (!payload || payload.rows !== undefined && !Array.isArray(payload.rows)) {
          throw new Error('Invalid Search Console response');
        }
        return payload.rows || [];
      };
      const [dateRows, queryRows, pageRows, countryRows] = await Promise.all([
        query('date', days),
        query('query', 20),
        query('page', 20),
        query('country', 20),
      ]);
      const report = buildReport({
        days,
        dateRows,
        queryRows,
        pageRows,
        countryRows,
        startDate,
        endDate,
        generatedAt: currentDate.toISOString(),
      });
      reportCache.set(cacheKey, { report, expiresAt: Date.now() + 10 * 60_000 });
      return send(res, 200, report);
    } catch {
      return send(res, 503, { error: 'search_console_unavailable' });
    }
  };
}

export default createSearchConsoleHandler();
