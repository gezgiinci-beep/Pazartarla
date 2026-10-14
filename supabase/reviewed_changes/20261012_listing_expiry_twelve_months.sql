-- Reviewed maintenance: the existing expiry is a generated, derived value.
-- Rebuild only that column; listings, owners, statuses, text and media are retained.
-- Do not put this in the automatic additive-migration directory or apply to production
-- before the isolated-test and encrypted-backup requirements in DATA_PROTECTION.md.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='listings'
      AND column_name='expires_at' AND is_generated='ALWAYS'
  ) THEN
    RAISE EXCEPTION 'EXPECTED_GENERATED_LISTING_EXPIRY_COLUMN_NOT_FOUND';
  END IF;
END;
$$;

DROP VIEW IF EXISTS public.listing_archive;
DROP POLICY IF EXISTS pazartarla_expiry_select_guard ON public.listings;
DROP INDEX IF EXISTS public.listings_expires_at_idx;
ALTER TABLE public.listings DROP COLUMN expires_at;
ALTER TABLE public.listings ADD COLUMN expires_at timestamptz
  GENERATED ALWAYS AS (
    ((created_at AT TIME ZONE 'Europe/Istanbul') + interval '12 months')
      AT TIME ZONE 'Europe/Istanbul'
  ) STORED;
CREATE INDEX listings_expires_at_idx ON public.listings(expires_at);

CREATE POLICY pazartarla_expiry_select_guard ON public.listings AS RESTRICTIVE
  FOR SELECT TO anon,authenticated
  USING ((select public.is_listing_admin()) OR expires_at > now());

CREATE OR REPLACE VIEW public.listing_archive WITH (security_invoker=true) AS
  SELECT id,title,created_at,expires_at,status FROM public.listings
  WHERE expires_at <= now() AND (select public.is_listing_admin());
REVOKE ALL ON public.listing_archive FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_archive TO authenticated;

CREATE OR REPLACE FUNCTION public.record_traffic_view(
  p_view_id uuid,p_visitor_id uuid,p_session_id uuid,p_route text,p_listing_id bigint,
  p_active_seconds integer,p_country text,p_region text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing private.traffic_views%ROWTYPE; purged boolean;
BEGIN
  IF p_view_id IS NULL OR p_visitor_id IS NULL OR p_session_id IS NULL
    OR p_route IS NULL OR p_route NOT IN ('home','detail','favorites','add')
    OR p_active_seconds IS NULL OR p_active_seconds NOT BETWEEN 0 AND 43200
    OR (p_country IS NOT NULL AND p_country !~ '^[A-Z]{2}$')
    OR (p_region IS NOT NULL AND (p_country IS NULL OR p_region !~ '^[A-Z0-9-]{1,12}$'))
    OR (p_route='detail' AND (p_listing_id IS NULL OR p_listing_id<=0))
    OR (p_route<>'detail' AND p_listing_id IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_traffic_view' USING ERRCODE='22023';
  END IF;
  UPDATE private.traffic_config SET last_purged_at=now()
    WHERE id AND last_purged_at<now()-interval '1 day' RETURNING true INTO purged;
  IF purged THEN DELETE FROM private.traffic_views WHERE started_at<now()-interval '90 days'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_visitor_id::text,713));
  SELECT * INTO existing FROM private.traffic_views WHERE view_id=p_view_id;
  IF FOUND THEN
    IF existing.visitor_id<>p_visitor_id OR existing.session_id<>p_session_id
      OR existing.route<>p_route OR existing.listing_id IS DISTINCT FROM p_listing_id THEN
      RAISE EXCEPTION 'traffic_identity_mismatch' USING ERRCODE='22023';
    END IF;
    UPDATE private.traffic_views SET
      active_seconds=greatest(active_seconds,least(p_active_seconds,
        greatest(0,floor(extract(epoch FROM now()-started_at)))::integer)),
      updated_at=now() WHERE view_id=p_view_id;
    RETURN true;
  END IF;
  IF (SELECT count(*) FROM private.traffic_views WHERE visitor_id=p_visitor_id
    AND started_at>now()-interval '1 hour')>=240 THEN
    RAISE EXCEPTION 'traffic_rate_limit' USING ERRCODE='54000';
  END IF;
  IF p_route='detail' AND NOT EXISTS(SELECT 1 FROM public.listings
    WHERE id=p_listing_id AND status='approved' AND expires_at>now()) THEN
    RAISE EXCEPTION 'traffic_listing_not_public' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.traffic_views(view_id,visitor_id,session_id,route,listing_id,country,region)
    VALUES(p_view_id,p_visitor_id,p_session_id,p_route,p_listing_id,p_country,p_region);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.record_traffic_view(uuid,uuid,uuid,text,bigint,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_traffic_view(uuid,uuid,uuid,text,bigint,integer,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION private.enforce_store_approval_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.store_memberships;active_count integer;
BEGIN
  -- The generated expiry is unavailable in BEFORE UPDATE; use the same calendar rule.
  IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.submitted_by IS NOT NULL
    AND (((NEW.created_at AT TIME ZONE 'Europe/Istanbul')+interval '12 months') AT TIME ZONE 'Europe/Istanbul')>now() THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.submitted_by::text,0));
    IF EXISTS(SELECT 1 FROM auth.users u JOIN private.listing_admins a ON a.email=lower(u.email) WHERE u.id=NEW.submitted_by) THEN RETURN NEW;END IF;
    SELECT * INTO m FROM private.store_memberships WHERE owner_id=NEW.submitted_by AND starts_at<=now() AND ends_at>now();
    IF m.owner_id IS NOT NULL THEN
      SELECT count(*) INTO active_count FROM public.listings
        WHERE submitted_by=NEW.submitted_by AND status='approved' AND expires_at>now() AND id<>NEW.id;
      IF active_count>=m.active_limit THEN RAISE EXCEPTION USING MESSAGE='LISTING_ACTIVE_LIMIT_REACHED';END IF;
    END IF;
  END IF;RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_store_approval_capacity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pazartarla_store_capacity_guard ON public.listings;
CREATE TRIGGER pazartarla_store_capacity_guard BEFORE UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.enforce_store_approval_capacity();

NOTIFY pgrst,'reload schema';
COMMIT;
