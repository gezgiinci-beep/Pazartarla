import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSubmissionDataHandler } from '../server/submissionHandlers.js';
import { readTursoSubmissionData } from '../server/tursoSubmissionData.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE listings (
      id INTEGER PRIMARY KEY, title TEXT, category TEXT, status TEXT,
      created_at TEXT, expires_at TEXT, submitted_by TEXT
    );
    CREATE TABLE private__store_memberships (
      owner_id TEXT, plan_name TEXT, monthly_limit INTEGER, active_limit INTEGER,
      starts_at TEXT, ends_at TEXT, billing_period TEXT
    );
    CREATE TABLE private__listing_submission_log (
      id INTEGER PRIMARY KEY, user_id TEXT, submitted_at TEXT
    );
  `);
  return {
    database: {
      get: async (sql, ...params) => sqlite.prepare(sql).get(...params),
      all: async (sql, ...params) => sqlite.prepare(sql).all(...params),
      run: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    },
    sqlite,
  };
}

function responseStub() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('normal verified member sees rolling 24-hour quota and own submissions only', async () => {
  const { database, sqlite } = fixture();
  const now = new Date('2026-10-13T12:00:00.000Z');
  for (const [id, submittedAt] of [
    [1, '2026-10-13T04:00:00.000Z'],
    [2, '2026-10-13T04:30:00.000Z'],
    [3, '2026-10-13T05:00:00.000Z'],
    [4, '2026-10-13T05:30:00.000Z'],
    [5, '2026-10-13T06:00:00.000Z'],
    [6, '2026-10-13T06:30:00.000Z'],
    [7, '2026-10-13T07:00:00.000Z'],
    [8, '2026-10-13T10:00:00.000Z'],
    [9, '2026-10-13T10:30:00.000Z'],
    [10, '2026-10-13T11:00:00.000Z'],
  ]) {
    sqlite.prepare(`INSERT INTO private__listing_submission_log(id, user_id, submitted_at)
      VALUES (?, 'member-a', ?)`).run(id, submittedAt);
  }
  sqlite.prepare(`INSERT INTO listings(id,title,category,status,created_at,expires_at,submitted_by)
    VALUES (10,'A','Mahsul','pending','2026-10-13T11:00:00Z','2027-10-13T11:00:00Z','member-a')`).run();
  sqlite.prepare(`INSERT INTO listings(id,title,category,status,created_at,expires_at,submitted_by)
    VALUES (11,'B','Mahsul','pending','2026-10-13T11:00:00Z','2027-10-13T11:00:00Z','member-b')`).run();

  const data = await readTursoSubmissionData(database, { userId: 'member-a', now });
  assert.deepEqual(data.quota, {
    email_verified: true,
    unlimited: false,
    limit: 10,
    used: 10,
    remaining: 0,
    next_available_at: '2026-10-14T04:00:00.000Z',
    period: 'rolling_day',
    can_submit: false,
  });
  assert.deepEqual(data.items.map(row => row.id), [10]);
  sqlite.close();
});

test('store quota keeps monthly submissions separate from approved and pending capacity', async () => {
  const { database, sqlite } = fixture();
  const now = new Date('2026-10-13T12:00:00.000Z');
  sqlite.prepare(`INSERT INTO private__store_memberships
    VALUES ('member-a','Paket 1',10,2,'2026-10-01T00:00:00.000Z','2026-11-01T00:00:00.000Z','month')`).run();
  sqlite.prepare(`INSERT INTO private__listing_submission_log(user_id, submitted_at)
    VALUES ('member-a','2026-10-05T12:00:00.000Z'),
           ('member-a','2026-10-07T12:00:00.000Z'),
           ('member-a','2026-10-09T12:00:00.000Z')`).run();
  sqlite.prepare(`INSERT INTO listings(id,title,category,status,created_at,expires_at,submitted_by)
    VALUES (1,'approved','Mahsul','approved','2026-10-01','2027-10-01','member-a'),
           (2,'pending','Mahsul','pending','2026-10-02','2027-10-02','member-a'),
           (3,'expired','Mahsul','pending','2025-10-02','2026-10-02','member-a')`).run();

  const data = await readTursoSubmissionData(database, { userId: 'member-a', now });
  assert.equal(data.quota.used, 3);
  assert.equal(data.quota.remaining, 7);
  assert.equal(data.quota.active_limit, 2);
  assert.equal(data.quota.active_used, 1);
  assert.equal(data.quota.pending_reserved, 1);
  assert.equal(data.quota.can_submit, false);
  sqlite.close();
});

test('admin and annual member quotas are unlimited without bypassing membership semantics', async () => {
  const { database, sqlite } = fixture();
  const now = new Date('2026-10-13T12:00:00.000Z');
  sqlite.prepare(`INSERT INTO private__store_memberships
    VALUES ('member-b','Paket 3',NULL,NULL,'2026-01-01T00:00:00.000Z','2027-01-01T00:00:00.000Z','year')`).run();
  const admin = await readTursoSubmissionData(database, { userId: 'admin', isAdmin: true, now });
  const member = await readTursoSubmissionData(database, { userId: 'member-b', now });
  assert.equal(admin.quota.unlimited, true);
  assert.equal(admin.quota.can_submit, true);
  assert.equal(member.quota.unlimited, true);
  assert.equal(member.quota.remaining, null);
  assert.equal(member.quota.period, 'membership_year');
  assert.equal(member.quota.can_submit, true);
  sqlite.close();
});

test('submission-data API stays closed unless enabled and requires a verified same-origin session', async () => {
  const { database, sqlite } = fixture();
  const handler = createSubmissionDataHandler({
    connect: () => database,
    authEnabled: () => true,
    secretProvider: () => 'x'.repeat(40),
    getSession: async (_database, request) => request.authenticated ? {
      user: { id: 'member-a', email_confirmed_at: '2026-01-01T00:00:00Z' },
      is_admin: false,
    } : null,
    now: () => new Date('2026-10-13T12:00:00Z'),
  });
  const unauthorized = responseStub();
  await handler({ method: 'GET', authenticated: false }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  const success = responseStub();
  await handler({ method: 'GET', authenticated: true }, success);
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.body.items, []);
  assert.equal(success.body.quota.remaining, 10);
  assert.equal(success.headers['Cache-Control'], 'private, no-store');
  const disabled = responseStub();
  await createSubmissionDataHandler({ connect: () => database, authEnabled: false })(
    { method: 'GET' }, disabled,
  );
  assert.equal(disabled.statusCode, 503);
  sqlite.close();
});
