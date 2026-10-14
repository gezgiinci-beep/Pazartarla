# Separate test database setup

This guide is for the one-year listing-expiry check. Do not use the live
Supabase project, live connection string, or real user/listing data.

## Before creating a project

Check the Supabase organization’s current usage and any price/upgrade notice.
The dashboard screenshot showed the Free-plan grace period had ended and log
ingestion was above its included amount. Do not confirm a paid upgrade to create
this test environment without reviewing and approving the charge.

## Setup sequence

1. Create a separate Supabase project named `PazarTarla-Test`. Use a new database
   password. Do not import or copy production users, listings, or images.
2. Prepare the project with the reviewed, schema-only application setup and
   synthetic test accounts/data. The SQL file
   `test_project_environment_guard.sql` is **not** the full schema setup; it must
   run only after the required schema exists.
3. Before using that SQL file, confirm the Supabase project name and reference in
   the dashboard. Open that test project’s SQL Editor, paste the file contents,
   and run it there. It intentionally fails if the `private` schema is missing
   or the environment marker already exists.
4. In Replit, open **Tools → Setup → Secrets → New secret** and add only
   test-project values:
   - `PAZARTARLA_TEST_DATABASE_URL` — the test project’s PostgreSQL URI.
   - `PAZARTARLA_TEST_PROJECT_REF` — that test project’s reference.
   - `PAZARTARLA_TEST_DATABASE_CA_FILE` — path to its downloaded TLS CA
     certificate file in the workspace.
   Never paste a connection URI or password into chat, Shell, or source code.
5. After the database reference, URL, CA file, schema, and `test` marker are
   verified, run the rollback-only database test with the reviewed 12-month
   change. Do not pass `--apply`, `--reset`, or `--seed`.

The test harness independently checks that the URL host and project reference
match, rejects the production project reference, requires verified TLS, and
checks the `private.environment_guard` marker before running fixtures.
Production still requires a fresh successful encrypted database-and-code backup
and the separate approved maintenance process in `DATA_PROTECTION.md`.
