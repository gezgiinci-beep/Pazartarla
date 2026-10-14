-- Run ONLY in the newly created, isolated PazarTarla test project.
-- First confirm the project name/ref in Supabase. Never run this in production.
-- This marks an already-prepared test schema; it does not create that schema.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';

DO $$
BEGIN
  IF to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'TEST_SCHEMA_SETUP_MUST_BE_COMPLETED_FIRST';
  END IF;
  IF to_regclass('private.environment_guard') IS NOT NULL THEN
    RAISE EXCEPTION 'ENVIRONMENT_GUARD_ALREADY_EXISTS_INSPECT_BEFORE_CONTINUING';
  END IF;
END;
$$;

CREATE TABLE private.environment_guard(
  singleton boolean PRIMARY KEY CHECK(singleton),
  environment text NOT NULL CHECK(environment='test')
);
ALTER TABLE private.environment_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.environment_guard FROM PUBLIC,anon,authenticated;
INSERT INTO private.environment_guard VALUES(true,'test');

COMMIT;
