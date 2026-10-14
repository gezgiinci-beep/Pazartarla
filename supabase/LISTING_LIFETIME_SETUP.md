# Listing dates and 12-month archive

**Safety first:** DATA_PROTECTION.md overrides historical production apply/test instructions. Never replay historical migrations or run fixtures on live data.

The historical `migrations/20261004_listing_expiry.sql` set an eight-month
expiry. The reviewed forward change
`reviewed_changes/20261012_listing_expiry_twelve_months.sql` changes that
generated date to 12 months. Do not apply it until it passes the isolated test
and the production backup/maintenance requirements in `DATA_PROTECTION.md`.
No listing rows or image files are deleted.

`created_at` remains the original server-owned submission timestamp. After the
reviewed forward change, PostgreSQL generates `expires_at` by adding **12
calendar months in Europe/Istanbul**, including month-end clamping and leap
years. This is not 240 days and does not start again on approval, editing or
featuring.

Expiration is enforced by an additional restrictive SELECT policy. Existing
approval, owner, administrator and submission-quota rules remain unchanged.
Normal visitors/members cannot retrieve expired listings, even with an older
frontend or a direct API query. Only administrators can retrieve archived records.

Listings aged 8–12 months will become public again when the forward change is
applied, because their approved status and original submission date are retained.
The archive is a **time-derived database view**, evaluated on each query. It
becomes effective at `expires_at` even if no browser is open. No cron extension,
scheduled service, row-status rewrite or file cleanup is required. Original
statuses, content, gallery metadata and images remain stored in `listings`.
The administrator's **İlan Arşivi** panel reads this protected view, supports
loading older pages and opening the full retained listing. Archive dates are the
actual expiry instant, not the date someone first opens the archive.

Cards, featured cards, results and detail pages display the real submission date
using Turkish formatting and Istanbul timezone. Invalid dates display explicit
missing-date text rather than inventing a date. Open public pages recheck their
already-loaded expiry timestamps every minute and reload on focus/visibility.
This avoids repeatedly downloading potentially large legacy gallery payloads.
Server access ends at the exact expiry timestamp.

Checks:
- `pnpm check:lifetime`: date/expiry logic and actual featured JSX rendering.
- `pnpm check:lifetime-db`: rollback-only DB policy/boundary/immutability checks.
- `node scripts/check-listing-lifetime-database.mjs --with-migration`: applies
  the historical setup and the reviewed 12-month change inside the rolled-back
  test transaction.
- `pnpm build`.

Re-publishing an expired listing requires creating a new listing, subject to the
existing moderation and member quotas. No renew/reset feature was requested.
Do not promote Vercel production without the user's approval.