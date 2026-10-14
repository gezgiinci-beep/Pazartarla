import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createAuthActionEmail, getAuthEmailConfiguration } from '../server/authEmail.js';
import { createAuthFlowHandler } from '../server/authFlowHandlers.js';
import { verifyAuthPassword } from '../server/tursoAuth.js';

const SECRET = 'synthetic-test-session-secret-for-auth-flows';
const NOW = new Date('2026-10-13T12:00:00.000Z');

function makeDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
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
    CREATE TABLE auth_action_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE TABLE auth_action_limits (
      action TEXT NOT NULL CHECK (
        action IN ('signup','resend_verification','request_password_reset','verify_email','reset_password')
      ),
      subject_hash TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL CHECK (attempts > 0),
      PRIMARY KEY (action, subject_hash)
    );
  `);
  const database = {
    get(sql, ...args) { return raw.prepare(sql).get(...args); },
    all(sql, ...args) { return raw.prepare(sql).all(...args); },
    run(sql, ...args) { return raw.prepare(sql).run(...args); },
    exec(sql) { return raw.exec(sql); },
    close() { raw.close(); },
  };
  database.transactionAsync = callback => ({
    immediate: async () => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = await callback(database);
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  });
  return database;
}

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function requestMock({ action = {}, origin = 'https://pazartarla.test', ip = '192.0.2.10' } = {}) {
  return {
    method: 'POST',
    body: action,
    headers: {
      host: 'pazartarla.test',
      origin,
      'x-forwarded-proto': 'https',
      'x-forwarded-for': ip,
    },
  };
}

function handler(action, database, options = {}) {
  return createAuthFlowHandler(action, {
    connect: () => database,
    enabled: true,
    secret: SECRET,
    env: { PAZARTARLA_AUTH_EMAIL_ENABLED: 'true' },
    sendEmail: options.sendEmail ?? (async () => {}),
    now: options.now ?? (() => NOW),
  });
}

async function call(route, request) {
  const response = responseMock();
  await route(request, response);
  return response;
}

test('Turso signup is unverified until a single-use email token is redeemed', async () => {
  const database = makeDatabase();
  const sent = [];
  try {
    const signup = handler('signup', database, { sendEmail: async mail => sent.push(mail) });
    const response = await call(signup, requestMock({
      action: { email: ' MEMBER@Example.test ', password: 'correct-horse-1' },
    }));
    assert.equal(response.statusCode, 202);
    assert.equal(response.body.ok, true);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].email, 'member@example.test');

    const user = database.get('SELECT id, email, password_hash, email_confirmed_at FROM app_users');
    assert.equal(user.email, 'member@example.test');
    assert.equal(user.email_confirmed_at, null);
    assert.notEqual(user.password_hash, 'correct-horse-1');
    assert.equal(
      database.get('SELECT token_hash FROM auth_action_tokens').token_hash,
      createHash('sha256').update(sent[0].token).digest('hex'),
    );

    const verify = handler('verify-email', database);
    const verified = await call(verify, requestMock({ action: { token: sent[0].token } }));
    assert.equal(verified.statusCode, 200);
    assert.equal(database.get('SELECT email_confirmed_at FROM app_users').email_confirmed_at, NOW.toISOString());
    assert.equal((await verifyAuthPassword(database, 'member@example.test', 'correct-horse-1', NOW)).ok, true);

    const reused = await call(verify, requestMock({ action: { token: sent[0].token } }));
    assert.equal(reused.statusCode, 400);
    assert.equal(reused.body.error, 'auth_action_token_invalid');
    assert.equal(reused.headers['Set-Cookie'], undefined);
  } finally {
    database.close();
  }
});

test('signup returns the same response for existing accounts and applies email throttling', async () => {
  const database = makeDatabase();
  const sent = [];
  try {
    const signup = handler('signup', database, { sendEmail: async mail => sent.push(mail) });
    const responses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      responses.push(await call(signup, requestMock({
        action: { email: 'same@example.test', password: 'correct-horse-1' },
      })));
    }
    assert.deepEqual(responses.map(response => response.statusCode), [202, 202, 202, 202, 202]);
    assert.equal(responses[0].body.message, responses[4].body.message);
    assert.equal(database.get('SELECT COUNT(*) AS count FROM app_users').count, 1);
    assert.equal(sent.length, 1);
  } finally {
    database.close();
  }
});

test('password recovery expires, is single-use, revokes sessions, and does not log in the user', async () => {
  const database = makeDatabase();
  const sent = [];
  try {
    const signup = handler('signup', database, { sendEmail: async mail => sent.push(mail) });
    await call(signup, requestMock({
      action: { email: 'member@example.test', password: 'correct-horse-1' },
    }));
    const verify = handler('verify-email', database);
    await call(verify, requestMock({ action: { token: sent[0].token } }));
    database.run(
      `INSERT INTO auth_sessions(token_hash, user_id, created_at, expires_at)
       SELECT 'old-session-hash', id, ?, ? FROM app_users WHERE email = ?`,
      NOW.toISOString(),
      new Date(NOW.getTime() + 60_000).toISOString(),
      'member@example.test',
    );

    const resetRequest = handler('request-reset', database, { sendEmail: async mail => sent.push(mail) });
    const requested = await call(resetRequest, requestMock({
      action: { email: 'member@example.test' },
    }));
    assert.equal(requested.statusCode, 202);
    assert.equal(sent[1].purpose, 'password_reset');
    assert.notEqual(sent[1].token, sent[0].token);

    const reset = handler('reset-password', database);
    const changed = await call(reset, requestMock({
      action: { token: sent[1].token, password: 'new-correct-horse-2' },
    }));
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.body.ok, true);
    assert.equal(changed.headers['Set-Cookie'], undefined);
    assert.equal(database.get('SELECT COUNT(*) AS count FROM auth_sessions').count, 0);
    assert.equal((await verifyAuthPassword(database, 'member@example.test', 'new-correct-horse-2', NOW)).ok, true);
    assert.equal((await verifyAuthPassword(database, 'member@example.test', 'correct-horse-1', NOW)).ok, false);

    const reuse = await call(reset, requestMock({
      action: { token: sent[1].token, password: 'another-correct-horse-3' },
    }));
    assert.equal(reuse.statusCode, 400);
    assert.equal(reuse.body.error, 'auth_action_token_invalid');
  } finally {
    database.close();
  }
});

test('expired verification tokens are rejected and unknown reset emails do not reveal account state', async () => {
  const database = makeDatabase();
  const sent = [];
  try {
    const signup = handler('signup', database, { sendEmail: async mail => sent.push(mail) });
    await call(signup, requestMock({
      action: { email: 'unverified@example.test', password: 'correct-horse-1' },
    }));
    const expiredVerify = handler('verify-email', database, { now: () => new Date(NOW.getTime() + 25 * 60 * 60 * 1000) });
    const expired = await call(expiredVerify, requestMock({ action: { token: sent[0].token } }));
    assert.equal(expired.statusCode, 400);
    assert.equal(expired.body.error, 'auth_action_token_invalid');

    const recovery = handler('request-reset', database);
    const known = await call(recovery, requestMock({ action: { email: 'unverified@example.test' } }));
    const unknown = await call(recovery, requestMock({ action: { email: 'missing@example.test' } }));
    assert.equal(known.statusCode, 202);
    assert.equal(unknown.statusCode, 202);
    assert.equal(known.body.message, unknown.body.message);
  } finally {
    database.close();
  }
});

test('auth flows reject cross-origin, disabled, and unconfigured email requests without creating users', async () => {
  const database = makeDatabase();
  try {
    const crossOrigin = createAuthFlowHandler('signup', {
      connect: () => database,
      enabled: true,
      secret: SECRET,
      sendEmail: async () => {},
      now: () => NOW,
    });
    const originResponse = await call(crossOrigin, requestMock({
      origin: 'https://attacker.example',
      action: { email: 'member@example.test', password: 'correct-horse-1' },
    }));
    assert.equal(originResponse.statusCode, 403);

    const disabled = createAuthFlowHandler('signup', {
      connect: () => database,
      enabled: false,
      secret: SECRET,
      sendEmail: async () => {},
    });
    assert.equal((await call(disabled, requestMock())).statusCode, 503);

    const noEmailConfig = createAuthFlowHandler('signup', {
      connect: () => database,
      enabled: true,
      secret: SECRET,
      env: {},
    });
    const unconfigured = await call(noEmailConfig, requestMock({
      action: { email: 'member@example.test', password: 'correct-horse-1' },
    }));
    assert.equal(unconfigured.statusCode, 503);
    assert.equal(unconfigured.body.error, 'email_actions_disabled');
    assert.equal(database.get('SELECT COUNT(*) AS count FROM app_users').count, 0);
  } finally {
    database.close();
  }
});

test('Resend action email requires HTTPS configuration and keeps tokens out of request URLs', async () => {
  const configuration = getAuthEmailConfiguration({
    NODE_ENV: 'production',
    RESEND_API_KEY: 'synthetic-resend-key',
    RESEND_FROM_EMAIL: 'PazarTarla <no-reply@pazartarla.com.tr>',
    PAZARTARLA_AUTH_BASE_URL: 'https://www.pazartarla.com.tr',
  });
  assert.ok(configuration);
  assert.equal(getAuthEmailConfiguration({
    NODE_ENV: 'production',
    RESEND_API_KEY: 'synthetic-resend-key',
    RESEND_FROM_EMAIL: 'no-reply@pazartarla.com.tr',
    PAZARTARLA_AUTH_BASE_URL: 'http://www.pazartarla.com.tr',
  }), null);

  let requestBody;
  const sender = createAuthActionEmail(configuration, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    requestBody = JSON.parse(options.body);
    return { ok: true };
  });
  const token = 'A'.repeat(43);
  await sender({ to: 'member@example.test', purpose: 'password_reset', token });
  assert.match(requestBody.text, /#auth_action=reset&token=/);
  assert.doesNotMatch(requestBody.text, /\?token=/);
  assert.match(requestBody.html, /#auth_action=reset&amp;token=/);
  assert.equal(requestBody.to, 'member@example.test');
});
