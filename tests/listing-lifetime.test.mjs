import test from 'node:test';
import assert from 'node:assert/strict';
import { formatListingDate, isListingArchived } from '../src/lib/listingLifetime.ts';
test('publication dates use Turkish date format and Istanbul timezone, not the browser locale', () => {
  assert.equal(formatListingDate('2026-10-04T22:30:00Z'), '05.10.2026');
  for (const value of [null,undefined,'invalid']) assert.equal(formatListingDate(value), 'Tarih bilgisi yok');
});
test('archive membership uses the server-generated expiry, including the exact instant', () => {
  const row = { expires_at: '2027-06-04T08:00:00Z' };
  const expires = Date.parse(row.expires_at);
  assert.equal(isListingArchived(row, expires - 1), false);
  assert.equal(isListingArchived(row, expires), true);
  assert.equal(isListingArchived(row, expires + 1), true);
});
test('missing or invalid legacy values do not invent an archive date', () => {
  assert.equal(isListingArchived({}), false);
  assert.equal(isListingArchived({expires_at:'bad'}), false);
});