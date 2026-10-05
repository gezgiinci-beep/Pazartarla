-- Reviewed, manually approved maintenance only. A fresh verified encrypted
-- database/code backup is required before production. No photo backfill,
-- SEO rewrite, auth allowlist change, or media-storage migration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_featured boolean;

CREATE OR REPLACE FUNCTION private.assert_featured_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN private.listing_admins a ON a.email=lower(u.email)
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='LISTING_FEATURE_ADMIN_REQUIRED';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION private.assert_featured_admin() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_featured_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.is_featured IS NOT NULL)
    OR (TG_OP='UPDATE' AND NEW.is_featured IS DISTINCT FROM OLD.is_featured) THEN
    IF current_setting('role',true) IN ('anon','authenticated') OR auth.uid() IS NOT NULL THEN
      PERFORM private.assert_featured_admin();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_featured_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER listing_featured_only_guard BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.guard_featured_only();

CREATE OR REPLACE FUNCTION public.get_listing_featured_snapshot(p_listing_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE item public.listings;
BEGIN
  PERFORM private.assert_featured_admin();
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_FEATURE_CONFLICT';
  END IF;
  RETURN jsonb_build_object('listing',to_jsonb(item),
    'edit_token',encode(sha256(convert_to(to_jsonb(item)::text,'UTF8')),'hex'));
END; $$;
REVOKE ALL ON FUNCTION public.get_listing_featured_snapshot(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_listing_featured_snapshot(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_listing_featured(
  p_listing_id integer,p_featured boolean,p_edit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE original public.listings; saved public.listings;
BEGIN
  PERFORM private.assert_featured_admin();
  IF p_featured IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_FEATURE_INVALID';
  END IF;
  SELECT * INTO original FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND OR p_edit_token IS DISTINCT FROM
    encode(sha256(convert_to(to_jsonb(original)::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_FEATURE_CONFLICT';
  END IF;
  UPDATE public.listings SET is_featured=p_featured WHERE id=p_listing_id RETURNING * INTO saved;
  IF (to_jsonb(saved)-'is_featured') IS DISTINCT FROM (to_jsonb(original)-'is_featured') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_FEATURE_PRESERVATION_FAILED';
  END IF;
  RETURN jsonb_build_object('listing',to_jsonb(saved));
END; $$;
REVOKE ALL ON FUNCTION public.set_listing_featured(integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_listing_featured(integer,boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
