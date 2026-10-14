import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { test } from 'node:test';
import {
  createAdminLoginHandler,
  createAuthLoginHandler,
  createAuthLogoutHandler,
  createAuthSessionHandler,
} from '../server/authHandlers.js';
import { verifyAuthPassword } from '../server/tursoAuth.js';

const SECRET = 'synthetic-test-session-secret-with-enough-bytes';
const NOW = new Date('2026-10-13T12:00:00.000Z');

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function requestMock({ method = 'POST', body = {}, cookie, origin = 'https://pazartarla.test' } = {}) {
  return {
    method,
    body,
    headers: {
      host: 'pazartarla.test',
      origin,
      'x-forwarded-proto': 'https',
      ...(cookie ? { cookie } : {}),
    },
  };
}

async function makeDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email_confirmed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      banned_until TEXT,
      deleted_at TEXT,
      is_anonymous INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      admin_reauth_at TEXT
    );
    CREATE TABLE auth_login_limits (
      subject_hash TEXT PRIMARY KEY,
      window_started_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL
    );
    CREATE TABLE private__listing_admins (
      email TEXT PRIMARY KEY NOT NULL
    );
  `);
  const wrapped = {
    get(sql, ...args) { return database.prepare(sql).get(...args); },
    run(sql, ...args) { return database.prepare(sql).run(...args); },
    exec(sql) { return database.exec(sql); },
    close() { database.close(); },
  };
  const hash = (password, rounds = 4) => bcrypt.hashSync(password, rounds).replace(/^\$2b\$/, '$2a$');
  const insertUser = (id, email, password, confirmedAt = NOW.toISOString()) => {
    database.prepare(`
      INSERT INTO app_users
        (id, email, password_hash, email_confirmed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email, hash(password), confirmedAt, NOW.toISOString(), NOW.toISOString());
  };
  return { database: wrapped, insertUser };
}

test('bcrypt Supabase password hashes validate without revealing the hash', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-horse-1');
    const valid = await verifyAuthPassword(database, ' MEMBER@example.test ', 'correct-horse-1', NOW);
    const invalid = await verifyAuthPassword(database, 'member@example.test', 'incorrect', NOW);
    assert.equal(valid.ok, true);
    assert.equal(valid.user.id, 'member-1');
    assert.equal(Object.hasOwn(valid, 'password_hash'), false);
    assert.equal(invalid.ok, false);
  } finally {
    database.close();
  }
});

test('verified member login creates an HttpOnly secure cookie and a server session', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-horse-1');
    const login = createAuthLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const response = responseMock();
    await login(requestMock({
      body: { email: ' MEMBER@example.test ', password: 'correct-horse-1' },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.email, 'member@example.test');
    assert.equal(response.body.is_admin, false);
    assert.equal(Object.hasOwn(response.body, 'access_token'), false);
    assert.match(response.headers['Set-Cookie'], /^__Host-pazartarla_session=/);
    assert.match(response.headers['Set-Cookie'], /HttpOnly/);
    assert.match(response.headers['Set-Cookie'], /Secure/);
    assert.match(response.headers['Set-Cookie'], /SameSite=Lax/);
    assert.equal(database.get('SELECT count(*) AS count FROM auth_sessions').count, 1);

    const cookie = response.headers['Set-Cookie'].split(';', 1)[0];
    const session = createAuthSessionHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const sessionResponse = responseMock();
    await session(requestMock({ method: 'GET', cookie }), sessionResponse);
    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.body.user.id, 'member-1');
    assert.equal(sessionResponse.body.is_admin, false);
  } finally {
    database.close();
  }
});

test('admin login requires both a verified account and a matching database admin record', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('admin-1', 'admin@example.test', 'correct-admin-1');
    database.run('INSERT INTO private__listing_admins(email) VALUES (?)', 'admin@example.test');
    const adminLogin = createAdminLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const response = responseMock();
    await adminLogin(requestMock({
      body: { email: 'admin@example.test', password: 'correct-admin-1' },
    }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.is_admin, true);
    assert.equal(response.body.admin_login, true);
    const session = database.get('SELECT admin_reauth_at FROM auth_sessions');
    assert.equal(session.admin_reauth_at, NOW.toISOString());
  } finally {
    database.close();
  }
});

test('non-admin password cannot create an admin session and unverified accounts stay blocked', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-member-1');
    insertUser('pending-1', 'pending@example.test', 'correct-pending-1', null);
    const adminLogin = createAdminLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const memberResponse = responseMock();
    await adminLogin(requestMock({
      body: { email: 'member@example.test', password: 'correct-member-1' },
    }), memberResponse);
    assert.equal(memberResponse.statusCode, 401);
    assert.equal(database.get('SELECT count(*) AS count FROM auth_sessions').count, 0);

    const login = createAuthLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const pendingResponse = responseMock();
    await login(requestMock({
      body: { email: 'pending@example.test', password: 'correct-pending-1' },
    }), pendingResponse);
    assert.equal(pendingResponse.statusCode, 403);
    assert.deepEqual(pendingResponse.body, { error: 'email_verification_required' });
  } finally {
    database.close();
  }
});

test('login is unavailable until explicitly enabled and rejects cross-origin posts', async () => {
  const disabled = createAuthLoginHandler({ enabled: false, secret: SECRET });
  const disabledResponse = responseMock();
  await disabled(requestMock(), disabledResponse);
  assert.equal(disabledResponse.statusCode, 503);

  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-horse-1');
    const login = createAuthLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const response = responseMock();
    await login(requestMock({
      origin: 'https://attacker.test',
      body: { email: 'member@example.test', password: 'correct-horse-1' },
    }), response);
    assert.equal(response.statusCode, 403);
    assert.equal(database.get('SELECT count(*) AS count FROM auth_sessions').count, 0);
  } finally {
    database.close();
  }
});

test('logout revokes the session and clears secure and development cookies', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-horse-1');
    const login = createAuthLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    const loginResponse = responseMock();
    await login(requestMock({
      body: { email: 'member@example.test', password: 'correct-horse-1' },
    }), loginResponse);
    const cookie = loginResponse.headers['Set-Cookie'].split(';', 1)[0];
    const logout = createAuthLogoutHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
    });
    const logoutResponse = responseMock();
    await logout(requestMock({ cookie }), logoutResponse);
    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(database.get('SELECT count(*) AS count FROM auth_sessions').count, 0);
    assert.equal(logoutResponse.headers['Set-Cookie'].length, 2);
  } finally {
    database.close();
  }
});

test('per-email login attempts are hashed and rate limited', async () => {
  const { database, insertUser } = await makeDatabase();
  try {
    insertUser('member-1', 'member@example.test', 'correct-horse-1');
    const login = createAuthLoginHandler({
      connect: () => database,
      enabled: true,
      secret: SECRET,
      now: () => NOW,
    });
    let lastResponse;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = responseMock();
      await login(requestMock({
        body: { email: 'member@example.test', password: 'wrong-password' },
      }), lastResponse);
    }
    assert.equal(lastResponse.statusCode, 429);
    const limit = database.get('SELECT subject_hash FROM auth_login_limits LIMIT 1');
    assert.match(limit.subject_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(limit.subject_hash, 'member@example.test');
  } finally {
    database.close();
  }
});
