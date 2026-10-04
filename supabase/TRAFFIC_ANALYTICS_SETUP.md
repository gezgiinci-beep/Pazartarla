# Administrator traffic statistics

Apply `migrations/20261004_traffic_analytics.sql` before releasing the frontend.
This only adds analytics tables/functions; listings, photos, settings, auth,
administrator identities and other storage are not modified.

## Data and access
- Public visitors explicitly opt in. Refusal/revocation and browser Do Not Track/
  Global Privacy Control stop new collection. Consent is remembered; browser
  identifiers are created only after opt-in and a visible focused page visit.
- A random browser ID (expires after 90 days) and shared browser session ID
  (renews after 30 minutes without foreground activity) identify estimated visits.
  Devices/private browsers are separate, not verified individual people.
- Track homepage/category changes, favorites, submission page, and approved
  active listing detail pages. Administrator screens and verified administrators
  are excluded. Do not send search text, category names, titles, contact details,
  auth IDs, account information, coordinates, user agent or raw IP.
- The same-origin Vercel `/api/traffic` function derives country and first-level
  region from platform geolocation headers. Missing geography is **unknown**,
  never a made-up default. VPN/mobile/provider locations can differ.
- Only www production POSTs collect. Preview, local and separate apex traffic
  are disabled. GET health/cleanup also works on the verified project's default
  production alias for the daily Vercel cron; no private statistics are returned.
- The function uses existing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY server
  environment variables, not a new privileged secret.
- Storage/metrics are private. Public/member callers cannot select rows or
  obtain reports. Only database-authorized administrators can call the report
  RPC; UI hiding alone is not the security boundary.
- Public ingestion is bounded and validates route, geography, public listing,
  identity, monotonic duration and server elapsed-time caps. New views limited
  to 240/browser/hour; heartbeats reuse the same row. Like browser analytics,
  anonymous ingestion is not bot/fraud-proof, and cannot justify billing.

## Metrics
Reports offer 7/30/90 calendar days in Europe/Istanbul with zero-filled daily
counts. Total page views include detail views; listing rankings show detail
views, not card impressions or ad click-through rates. Region share is region
views/all site views; listing share is listing detail views/all detail views.
Returning rate is browsers with more than one session/all browsers in period.
Frequency is sessions/browser; average duration is active seconds/sessions.
Regions are attached to the first received page event.

Visible focused time is sampled every five seconds and saved every 15 seconds,
with best-effort final beacon/keepalive on hide/navigation/close. It is not
video playback or proof someone read the page. Sleep gaps, network delays,
blocking and failed final delivery can undercount duration. Backend caps ensure
late/duplicate/out-of-order updates do not inflate views or regress duration.

Data starts at setup/new release/visitor consent; no historical counts are
invented. Reports refresh on mount/period change and manual refresh only.
Failures are explicit; no hardcoded/demo figures or fallback reports.

## Retention and release
The daily `0 0 * * *` Vercel cron calls the public health/cleanup function:
analytics rows older than 90 days are deleted. Collection and manual health
reads also prune old analytics. Cleanup never deletes listings or media.
The cron requires the deployment to remain active; provider outages may delay
cleanup. This daily schedule is suitable for Hobby's once-daily cron limit.
`routes` checks filesystem/functions before the SPA fallback.

Production publication still requires separate approval for the www project.
Native checks: `node --experimental-strip-types --test tests/traffic-analytics.test.mjs`;
rollback-only database check: `node scripts/check-traffic-database.mjs`;
add `--apply` only after approving additive schema application.