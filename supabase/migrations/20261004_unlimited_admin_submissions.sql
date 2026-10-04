BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(submitter::text, 0));
  -- Permission comes from the private allowlist, never client metadata.
  IF NOT public.is_listing_admin() THEN
    SELECT count(*) INTO recent_count
    FROM private.listing_submission_log
    WHERE user_id = submitter
      AND submitted_at > clock_timestamp() - interval '24 hours';
    IF recent_count >= 3 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_DAILY_LIMIT_REACHED';
    END IF;
  END IF;
  NEW.submitted_by := submitter;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_listing_submission() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_listing_submission_quota()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  submitter uuid := auth.uid();
  verified boolean := public.is_verified_listing_submitter();
  unlimited boolean := verified AND public.is_listing_admin();
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
    'unlimited', unlimited,
    'limit', CASE WHEN unlimited THEN NULL ELSE 3 END,
    'used', recent_count,
    'remaining', CASE WHEN unlimited THEN NULL WHEN verified THEN greatest(0, 3 - recent_count) ELSE 0 END,
    'next_available_at', CASE WHEN NOT unlimited AND recent_count >= 3 THEN next_available ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_listing_submission_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_submission_quota() TO anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';