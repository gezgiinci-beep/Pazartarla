# Listing dates and eight-month archive

Apply `migrations/20261004_listing_expiry.sql` to the existing external Supabase
database before releasing the updated frontend. No rows or image files are deleted.

`created_at` remains the original server-owned submission timestamp. PostgreSQL
generates `expires_at` by adding **eight calendar months in Europe/Istanbul**,
including month-end clamping and leap years. This is not 240 days and does not
start again on approval, editing or featuring.

Expiration is enforced by an additional restrictive SELECT policy. Existing
approval, owner, administrator and submission-quota rules remain unchanged.
Normal visitors/members cannot retrieve expired listings, even with an older
frontend or a direct API query. Only administrators can retrieve archived records.

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
- `node scripts/check-listing-lifetime-database.mjs --with-migration`: same checks
  with the proposed setup itself inside the rolled-back transaction.
- `pnpm build`.

Re-publishing an expired listing requires creating a new listing, subject to the
existing moderation and member quotas. No renew/reset feature was requested.
Do not promote Vercel production without the user's approval.