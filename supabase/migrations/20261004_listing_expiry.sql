BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Eight calendar months in the site's timezone, not a fixed number of days.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS expires_at timestamptz
  GENERATED ALWAYS AS (
    ((created_at AT TIME ZONE 'Europe/Istanbul') + interval '8 months') AT TIME ZONE 'Europe/Istanbul'
  ) STORED;
CREATE INDEX IF NOT EXISTS listings_expires_at_idx ON public.listings(expires_at);

-- Existing approval/owner/admin policies remain intact. An additional restrictive
-- gate makes expiration apply even to old clients and unrelated permissive policies.
DROP POLICY IF EXISTS pazartarla_expiry_select_guard ON public.listings;
CREATE POLICY pazartarla_expiry_select_guard ON public.listings AS RESTRICTIVE
  FOR SELECT TO anon,authenticated
  USING ((select public.is_listing_admin()) OR expires_at > now());

CREATE OR REPLACE FUNCTION private.protect_listing_created_at() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_CREATION_DATE_IMMUTABLE';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.protect_listing_created_at() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pazartarla_creation_date_guard ON public.listings;
CREATE TRIGGER pazartarla_creation_date_guard BEFORE UPDATE OF created_at ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.protect_listing_created_at();

-- Time-derived archive, evaluated by PostgreSQL on every read: no scheduler or
-- open browser is required. Records, original statuses, and images are retained.
CREATE OR REPLACE VIEW public.listing_archive WITH (security_invoker=true) AS
  SELECT id,title,created_at,expires_at,status FROM public.listings
  WHERE expires_at <= now() AND (select public.is_listing_admin());
REVOKE ALL ON public.listing_archive FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_archive TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;