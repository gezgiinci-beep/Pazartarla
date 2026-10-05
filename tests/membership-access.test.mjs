import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { membershipAccess, membershipContextKey, membershipDataForContext } from '../src/lib/membershipAccess.ts';

// In-memory fixtures only: no accounts, payments or requests are written.
const session = { access_token: 'synthetic-only', user: { id: 'fixture-owner', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } };
const plan = { id: 'package-1', name: 'Paket 1', monthly_price_try: 350, monthly_limit: 30, active_limit: 100 };
const request = { id: 'fixture-request', revision: 1, status: 'pending', store_name: 'PRIVATE_REQUEST_FIXTURE', email: 'fixture@example.invalid', plan_name: 'Paket 1', monthly_price_try: 350, monthly_limit: 30, active_limit: 100, created_at: '2026-01-01T00:00:00Z' };
const privateData = {
  plans: [plan], stores: [], store: null, listings: [],
  mine: {
    store: { id: 'fixture-store', name: 'PRIVATE_STORE_FIXTURE', description: '', revision: 1, listing_ids: [] },
    membership: { plan_name: 'PRIVATE_MEMBERSHIP_FIXTURE', starts_at: '2026-01-01T00:00:00Z', ends_at: '2031-01-01T00:00:00Z', monthly_limit: 30, active_limit: 100, revision: 1 },
    requests: [request],
  },
  requests: [request],
};
const state = data => ({ data, loading: false, busy: false, error: '', actionError: '', message: '', refresh: async () => {}, action: async () => { throw Error('SSR must not mutate'); } });
const noop = () => {};
let server, MembershipPage, MembershipAdmin;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    esbuild: { jsx: 'automatic' }, logLevel: 'silent',
  });
  ({ default: MembershipPage } = await server.ssrLoadModule('/src/components/MembershipPage.tsx'));
  ({ default: MembershipAdmin } = await server.ssrLoadModule('/src/components/MembershipAdmin.tsx'));
});
after(async () => { await server?.close(); });
const page = (actor, data = privateData) => renderToStaticMarkup(createElement(MembershipPage, { state: state(data), session: actor, onSignIn: noop, onStore: noop, onSubmitted: noop }));
const admin = (actor, authorized) => renderToStaticMarkup(createElement(MembershipAdmin, { state: state(privateData), session: actor, authorized, onBack: noop }));

test('No session, incomplete session and anonymous accounts cannot manage a store', () => {
  for (const actor of [null, {}, { user: session.user }, { ...session, user: { ...session.user, is_anonymous: true } }]) {
    assert.equal(membershipAccess(actor).verified, false);
    const html = page(actor);
    assert.match(html, /membership-login-required/);
    assert.match(html, /Paket 1/);
    assert.doesNotMatch(html, /<form|Üyelik talebi gönder|Mağaza bilgilerini kaydet|PRIVATE_/);
  }
});
test('Unverified email hides private forms, current membership and request history', () => {
  const html = page({ ...session, user: { ...session.user, email_confirmed_at: null } });
  assert.match(html, /e-posta adresinizi doğrulayın/);
  assert.doesNotMatch(html, /<form|Üyelik talebi gönder|PRIVATE_/);
});
test('Verified store owner retains store editing, membership and own history', () => {
  const html = page(session);
  assert.match(html, /Mağaza bilgilerini kaydet/);
  assert.match(html, /PRIVATE_MEMBERSHIP_FIXTURE/);
  assert.match(html, /PRIVATE_REQUEST_FIXTURE/);
});
test('Verified applicant sees application and a clear missing-package explanation', () => {
  const html = page(session, { ...privateData, mine: null });
  assert.match(html, /Üyelik talebi gönder/);
  assert.match(html, /yukarıdaki paketlerden birini seçin/);
});
test('Payment panel fails closed without both verified session and unlocked admin authorization', () => {
  for (const [actor, allowed] of [[null, false], [null, true], [session, false], [{ ...session, user: { ...session.user, email_confirmed_at: null } }, true]]) {
    const html = admin(actor, allowed);
    assert.match(html, /membership-admin-login-required/);
    assert.doesNotMatch(html, /PRIVATE_|fixture@example|Ödemeyi doğrula ve onayla|<input/);
  }
  assert.match(admin(session, true), /Ödemeyi doğrula ve onayla/);
});
test('Logout, another account, admin relock and store navigation immediately mask stale snapshots', () => {
  const context = membershipContextKey('owner-a', true, null);
  const snapshot = { context, data: privateData };
  assert.equal(membershipDataForContext(snapshot, context), privateData);
  for (const next of [
    membershipContextKey(undefined, false, null),
    membershipContextKey('owner-b', true, null),
    membershipContextKey('owner-a', false, null),
    membershipContextKey('owner-a', true, 'another-store'),
  ]) assert.equal(membershipDataForContext(snapshot, next), null);
});
