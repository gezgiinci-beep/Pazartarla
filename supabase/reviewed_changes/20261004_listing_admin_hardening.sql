-- Reviewed maintenance only. Do not replay historical migrations in production.
-- Requires DATA_PROTECTION.md backup, isolated tests and explicit approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Resolve permission from the current verified Auth account, not a stale email
-- claim, user_metadata, browser state, or a recycled/unconfirmed email address.
CREATE OR REPLACE FUNCTION public.is_listing_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN private.listing_admins a ON a.email=lower(u.email)
    WHERE u.id=auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND NOT coalesce(u.is_anonymous,false)
      AND (u.banned_until IS NULL OR u.banned_until<=now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_listing_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_listing_admin() TO anon,authenticated;

-- The compatibility SEO suffix stores gallery AND featured state. A member
-- must not smuggle a featured flag into a pending submission and have it become
-- featured on ordinary approval. Preserve gallery bytes and SEO text exactly.
CREATE OR REPLACE FUNCTION private.enforce_submission_feature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  marker constant text := '\n__PAZARTARLA_META_V1__:';
  position integer;
  encoded text;
  decoded bytea := ''::bytea;
  metadata jsonb;
  i integer := 1;
  part text;
BEGIN
  IF public.is_listing_admin() OR NEW.seotags IS NULL THEN RETURN NEW; END IF;
  -- The browser parser uses the LAST occurrence of the marker.
  position := length(NEW.seotags)-strpos(reverse(NEW.seotags),reverse(marker))-length(marker)+2;
  IF strpos(NEW.seotags,marker)=0 THEN RETURN NEW; END IF;
  encoded := substr(NEW.seotags,position+length(marker));
  WHILE i<=length(encoded) LOOP
    part := substr(encoded,i,1);
    IF part='%' THEN
      part := substr(encoded,i+1,2);
      IF length(part)<>2 OR part !~ '^[0-9A-Fa-f]{2}$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_METADATA_INVALID';
      END IF;
      decoded := decoded || decode(part,'hex');
      i := i+3;
    ELSE
      decoded := decoded || convert_to(part,'UTF8');
      i := i+1;
    END IF;
  END LOOP;
  BEGIN
    metadata := convert_from(decoded,'UTF8')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_METADATA_INVALID';
  END;
  IF jsonb_typeof(metadata)<>'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_METADATA_INVALID';
  END IF;
  IF metadata->'isFeatured'='true'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_FEATURE_ADMIN_REQUIRED';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.enforce_submission_feature() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pazartarla_submission_feature_guard ON public.listings;
CREATE TRIGGER pazartarla_submission_feature_guard BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.enforce_submission_feature();

COMMIT;
NOTIFY pgrst,'reload schema';