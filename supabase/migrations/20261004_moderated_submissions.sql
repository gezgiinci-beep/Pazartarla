BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS listings_submitted_by_created_at
  ON public.listings (submitted_by, created_at DESC);

CREATE TABLE IF NOT EXISTS private.listing_submission_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS listing_submission_log_user_time
  ON private.listing_submission_log (user_id, submitted_at DESC);
ALTER TABLE private.listing_submission_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.listing_submission_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_verified_listing_submitter()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users AS u
    WHERE u.id = auth.uid()
      AND u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
      AND NOT COALESCE(u.is_anonymous, false)
  );
$$;
REVOKE ALL ON FUNCTION public.is_verified_listing_submitter() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_listing_submitter() TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_listing_submission()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  submitter uuid := auth.uid();
  recent_count integer;
BEGIN
  IF submitter IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'LISTING_VERIFIED_ACCOUNT_REQUIRED';
  END IF;
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'LISTING_APPROVAL_REQUIRED';
  END IF;

  -- Serialize concurrent submissions from the same account, not just one browser.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(submitter::text, 0));
  SELECT count(*) INTO recent_count
  FROM private.listing_submission_log
  WHERE user_id = submitter
    AND submitted_at > clock_timestamp() - interval '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_DAILY_LIMIT_REACHED';
  END IF;
  NEW.submitted_by := submitter;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.record_listing_submission()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.listing_submission_log (user_id, submitted_at)
  VALUES (NEW.submitted_by, clock_timestamp());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_listing_submission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_listing_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pazartarla_submission_guard ON public.listings;
CREATE TRIGGER pazartarla_submission_guard BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.enforce_listing_submission();
DROP TRIGGER IF EXISTS pazartarla_submission_log ON public.listings;
CREATE TRIGGER pazartarla_submission_log AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.record_listing_submission();

CREATE OR REPLACE FUNCTION public.get_listing_submission_quota()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  submitter uuid := auth.uid();
  verified boolean := public.is_verified_listing_submitter();
  recent_count integer := 0;
  next_available timestamptz;
BEGIN
  IF verified THEN
    SELECT count(*), min(submitted_at) + interval '24 hours'
      INTO recent_count, next_available
    FROM private.listing_submission_log
    WHERE user_id = submitter
      AND submitted_at > now() - interval '24 hours';
  END IF;
  RETURN jsonb_build_object(
    'email_verified', verified,
    'limit', 3,
    'used', recent_count,
    'remaining', CASE WHEN verified THEN greatest(0, 3 - recent_count) ELSE 0 END,
    'next_available_at', CASE WHEN recent_count >= 3 THEN next_available ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_listing_submission_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_submission_quota() TO anon, authenticated;

-- Replace only this project's known insertion guards; preserve unknown policies.
DROP POLICY IF EXISTS pazartarla_public_insert_approved ON public.listings;
DROP POLICY IF EXISTS pazartarla_insert_guard ON public.listings;
DROP POLICY IF EXISTS pazartarla_submit_pending ON public.listings;
CREATE POLICY pazartarla_submit_pending ON public.listings AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND submitted_by = auth.uid());
CREATE POLICY pazartarla_insert_guard ON public.listings AS RESTRICTIVE
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND submitted_by = auth.uid()
    AND public.is_verified_listing_submitter()
  );

ALTER POLICY pazartarla_select_guard ON public.listings
  USING (
    status = 'approved'
    OR public.is_listing_admin()
    OR submitted_by = auth.uid()
  );
DROP POLICY IF EXISTS pazartarla_owner_select ON public.listings;
CREATE POLICY pazartarla_owner_select ON public.listings AS PERMISSIVE
  FOR SELECT TO authenticated USING (submitted_by = auth.uid());

REVOKE INSERT ON public.listings FROM PUBLIC, anon;
GRANT INSERT ON public.listings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.listings_id_seq TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';