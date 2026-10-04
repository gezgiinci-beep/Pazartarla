# Shared announcement and category settings

**Safety first:** DATA_PROTECTION.md overrides historical production apply/test instructions. Never replay historical migrations or run fixtures on live data.

Apply `migrations/20261004_shared_site_settings.sql` after the existing admin migration.
It adds one `public.site_settings` record and uses the existing database-admin allowlist.
It does not change listings, account verification, or listing quotas.

The migration seeds the previous default announcement/categories only if no settings record
exists. Re-running it never overwrites saved settings. Visitors can read settings; only
authenticated, allowlisted administrators can update the announcement or categories.
Client inserts, deletions, and changes to the record ID/revision/timestamp are not allowed.

The UI loads settings on every mount, on tab/window focus, and every minute while visible.
It updates only after the backend confirms a save. Failed saves retain drafts. A version
check prevents two browsers from silently overwriting each other's edits. If a conflict
occurs, review the refreshed settings; use “Sunucudaki duyuruyu al” to reset an announcement draft.
An empty announcement intentionally hides the banner. Keep at least one main category
with at least one subcategory so the listing form has valid choices.

Checks:
- `pnpm check:settings` (Node 22.6+): API contract/error/validation checks; no live writes.
- `pnpm check:settings-db`: rollback-only database permission and mutation checks.
  Requires the existing `SUPABASE_DATABASE_URL` and the official Supabase CA certificate,
  specified by `SUPABASE_DATABASE_CA_FILE` (default `/tmp/pazartarla-supabase-ca.crt`).
  No passwords, keys, or customer data are logged.

Release: apply the additive database migration first, then release the frontend. An older
frontend continues working while the new record exists. Do not promote a preview to
production without confirming the intended Vercel project and current production branch.