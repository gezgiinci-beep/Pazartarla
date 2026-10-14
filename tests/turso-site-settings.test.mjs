import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createSiteSettingsHandler } from '../server/siteSettingsHandlers.js';

const SECRET = 'synthetic-settings-session-secret-with-32-bytes';
const NOW = new Date('2026-10-13T12:00:00.000Z');
const INITIAL = {
  id: 'public',
  announcement: 'Başlangıç duyurusu',
  categories: { Mahsuller: ['Ceviz', 'Kiraz'] },
  featured_offer: { monthly_price_try: 150, description: 'Vitrin teklifi' },
  revision: 1,
};

function createDatabase() {
  const inner = new DatabaseSync(':memory:');
  inner.exec(`
    CREATE TABLE site_settings (
      id TEXT PRIMARY KEY CHECK (id = 'public'),
      announcement TEXT NOT NULL,
      categories TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      featured_offer TEXT NOT NULL
    );
  `);
  inner.prepare(`
    INSERT INTO site_settings (id, announcement, categories, revision, featured_offer)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    INITIAL.id,
    INITIAL.announcement,
    JSON.stringify(INITIAL.categories),
    INITIAL.revision,
    JSON.stringify(INITIAL.featured_offer),
  );
  return {
    get(sql, ...args) { return inner.prepare(sql).get(...args); },
    run(sql, ...args) { return inner.prepare(sql).run(...args); },
    close() { inner.close(); },
  };
}

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function requestMock(method = 'GET', body = {}, origin = 'https://pazartarla.test') {
  return {
    method,
    body,
    headers: { host: 'pazartarla.test', origin, 'x-forwarded-proto': 'https' },
  };
}

function handler(database, session = {
  is_admin: true,
  admin_reauth_at: NOW.toISOString(),
}) {
  return createSiteSettingsHandler({
    connect: () => database,
    authEnabled: true,
    secret: SECRET,
    getSession: async () => session,
    now: () => NOW,
  });
}

test('public Turso settings endpoint returns validated JSON data with bounded stale-if-error caching', async () => {
  const database = createDatabase();
  try {
    const response = responseMock();
    await handler(database)(requestMock(), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.settings, INITIAL);
    assert.equal(response.headers['Cache-Control'], 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600');
    assert.equal(response.headers['Vercel-CDN-Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600');
  } finally {
    database.close();
  }
});

test('site settings update is optimistic, atomic and limited to one validated field', async () => {
  const database = createDatabase();
  try {
    const response = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 1,
      patch: { announcement: 'Yeni duyuru' },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.settings.announcement, 'Yeni duyuru');
    assert.equal(response.body.settings.revision, 2);

    const conflict = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 1,
      patch: { announcement: 'Eski revizyon' },
    }), conflict);
    assert.equal(conflict.statusCode, 409);
    assert.deepEqual(conflict.body, { error: 'settings_conflict' });

    const invalid = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 2,
      patch: { announcement: 'A', categories: { Mahsuller: ['Ceviz'] } },
    }), invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(database.get('SELECT revision FROM site_settings').revision, 2);
  } finally {
    database.close();
  }
});

test('category and featured-offer updates store JSON and return canonical validated values', async () => {
  const database = createDatabase();
  try {
    const categories = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 1,
      patch: { categories: { Traktör: ['İkinci El', 'Sıfır'] } },
    }), categories);
    assert.equal(categories.statusCode, 200);
    assert.deepEqual(categories.body.settings.categories, { Traktör: ['İkinci El', 'Sıfır'] });

    const offer = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 2,
      patch: { featured_offer: { monthly_price_try: 175.5, description: 'Yeni fiyat' } },
    }), offer);
    assert.equal(offer.statusCode, 200);
    assert.deepEqual(offer.body.settings.featured_offer, {
      monthly_price_try: 175.5,
      description: 'Yeni fiyat',
    });
    assert.equal(offer.body.settings.revision, 3);
  } finally {
    database.close();
  }
});

test('settings writes require same-origin, enabled Turso auth, an admin and recent password reauthentication', async () => {
  const database = createDatabase();
  try {
    const crossOrigin = responseMock();
    await handler(database)(requestMock('PATCH', {
      revision: 1,
      patch: { announcement: 'No' },
    }, 'https://attacker.test'), crossOrigin);
    assert.equal(crossOrigin.statusCode, 403);

    const member = responseMock();
    await handler(database, { is_admin: false, admin_reauth_at: NOW.toISOString() })(
      requestMock('PATCH', { revision: 1, patch: { announcement: 'No' } }), member,
    );
    assert.equal(member.statusCode, 403);
    assert.deepEqual(member.body, { error: 'admin_required' });

    const staleAdmin = responseMock();
    await handler(database, {
      is_admin: true,
      admin_reauth_at: new Date(NOW.getTime() - 16 * 60 * 1000).toISOString(),
    })(requestMock('PATCH', { revision: 1, patch: { announcement: 'No' } }), staleAdmin);
    assert.equal(staleAdmin.statusCode, 403);
    assert.deepEqual(staleAdmin.body, { error: 'admin_reauthentication_required' });
    assert.equal(database.get('SELECT revision FROM site_settings').revision, 1);
  } finally {
    database.close();
  }
});

test('settings writes stay closed unless the Turso auth backend is explicitly enabled', async () => {
  const database = createDatabase();
  try {
    const closed = createSiteSettingsHandler({
      connect: () => database,
      authEnabled: false,
      secret: SECRET,
    });
    const response = responseMock();
    await closed(requestMock('PATCH', {
      revision: 1,
      patch: { announcement: 'No' },
    }), response);
    assert.equal(response.statusCode, 503);
    assert.equal(database.get('SELECT revision FROM site_settings').revision, 1);
  } finally {
    database.close();
  }
});

test('site settings read fallback preserves 402/429 and bounds Retry-After without exposing details', async () => {
  for (const status of [402, 429]) {
    const handler = createSiteSettingsHandler({
      connect() {
        const error = new Error('private upstream detail');
        error.status = status;
        error.retryAfterMs = 90_000;
        throw error;
      },
    });
    const response = responseMock();
    await handler(requestMock('GET'), response);
    assert.equal(response.statusCode, status);
    assert.equal(response.headers['Retry-After'], '90');
    assert.deepEqual(response.body, { error: 'settings_unavailable' });
    assert.equal(JSON.stringify(response.body).includes('private upstream detail'), false);
  }
});
