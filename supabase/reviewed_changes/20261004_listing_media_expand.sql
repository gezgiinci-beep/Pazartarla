-- Reviewed maintenance, NOT the automatic additive runner. Requires the
-- owner-edit RPCs, verified encrypted backup, isolated tests and explicit approval.
-- No existing listing is rewritten in this phase. Old clients remain readable.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS gallery_paths text[];
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_featured boolean;
CREATE INDEX IF NOT EXISTS listings_featured_idx ON public.listings(is_featured,status);
CREATE INDEX IF NOT EXISTS listings_gallery_paths_idx ON public.listings USING gin(gallery_paths);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('listing-media','listing-media',true,20971520,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO NOTHING;
-- Public listing photos, including legacy photos, have public URLs.
-- No overwrite/delete policy: replacement must never erase an acknowledged
-- or uncertain reference. Garbage collection is a separately reviewed operation.
CREATE POLICY listing_media_read ON storage.objects FOR SELECT TO anon,authenticated
USING(bucket_id='listing-media');
CREATE POLICY listing_media_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='listing-media' AND
  (public.is_listing_admin() OR public.is_verified_listing_submitter()) AND
  name ~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp|gif)$'));
-- Existing permissive ALL policies must not broaden this bucket's authority.
CREATE POLICY listing_media_insert_guard ON storage.objects AS RESTRICTIVE
FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'listing-media' OR
  ((public.is_listing_admin() OR public.is_verified_listing_submitter()) AND
   name ~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp|gif)$')));
CREATE POLICY listing_media_no_update ON storage.objects AS RESTRICTIVE
FOR UPDATE TO anon,authenticated USING(bucket_id<>'listing-media') WITH CHECK(bucket_id<>'listing-media');
CREATE POLICY listing_media_no_delete ON storage.objects AS RESTRICTIVE
FOR DELETE TO anon,authenticated USING(bucket_id<>'listing-media');

CREATE OR REPLACE FUNCTION private.validate_listing_gallery(paths text[], require_owner boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE path text;
BEGIN
  IF paths IS NULL OR coalesce(array_ndims(paths),1)<>1 OR cardinality(paths)>10 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_MEDIA_INVALID';
  END IF;
  FOREACH path IN ARRAY paths LOOP
    IF path IS NULL OR length(path)>2048 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_MEDIA_INVALID';
    END IF;
    IF path LIKE 'listing-media/%' THEN
      IF path !~ '^listing-media/([a-f0-9-]{36}|migrated/[0-9]+)/[a-zA-Z0-9._-]+$'
        OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='listing-media'
          AND name=substr(path,length('listing-media/')+1))
        OR (require_owner AND split_part(path,'/',2) IS DISTINCT FROM auth.uid()::text) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_MEDIA_INVALID';
      END IF;
    ELSIF path !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
      OR strpos(path,'/storage/v1/object/public/listing-media/')>0 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_MEDIA_INVALID';
    END IF;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION private.validate_listing_gallery(text[],boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.enforce_listing_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- NULL signifies an unmigrated legacy row, not an empty gallery.
  IF NEW.gallery_paths IS NOT NULL AND
    (TG_OP='INSERT' OR NEW.gallery_paths IS DISTINCT FROM OLD.gallery_paths) THEN
    PERFORM private.validate_listing_gallery(NEW.gallery_paths,
      TG_OP='INSERT' AND auth.uid() IS NOT NULL AND NOT public.is_listing_admin());
  END IF;
  IF NEW.gallery_paths IS NOT NULL THEN
    IF NEW.image ~* '^(data|blob):' OR (
      strpos(coalesce(NEW.seotags,''),'\n__PAZARTARLA_META_V1__:')>0 AND
      (TG_OP='INSERT' OR NEW.seotags IS DISTINCT FROM OLD.seotags)) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_MEDIA_INLINE_FORBIDDEN';
    END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_listing_admin() AND NEW.is_featured IS TRUE
    AND (TG_OP='INSERT' OR NEW.is_featured IS DISTINCT FROM OLD.is_featured) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_FEATURE_ADMIN_REQUIRED';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.enforce_listing_media() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER listing_media_guard BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.enforce_listing_media();

CREATE OR REPLACE FUNCTION public.update_listing_media(
  p_listing_id integer,p_changes jsonb,p_edit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE item public.listings; candidate public.listings; key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
  END IF;
  FOR key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF key NOT IN ('image','seotags','gallery_paths','is_featured')
      OR (key IN ('image','seotags') AND (jsonb_typeof(p_changes->key)<>'string'
        OR length(p_changes->>key)>20000000))
      OR (key='is_featured' AND jsonb_typeof(p_changes->key)<>'boolean')
      OR (key='gallery_paths' AND jsonb_typeof(p_changes->key)<>'array') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_FIELD_FORBIDDEN';
    END IF;
  END LOOP;
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND OR p_edit_token IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(item)::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_EDIT_CONFLICT';
  END IF;
  candidate:=jsonb_populate_record(item,p_changes);
  IF p_changes ? 'gallery_paths' THEN
    PERFORM private.validate_listing_gallery(candidate.gallery_paths,false);
  END IF;
  UPDATE public.listings SET image=candidate.image,seotags=candidate.seotags,
    gallery_paths=candidate.gallery_paths,is_featured=candidate.is_featured
  WHERE id=item.id RETURNING * INTO item;
  RETURN jsonb_build_object('listing',to_jsonb(item));
END; $$;
REVOKE ALL ON FUNCTION public.update_listing_media(integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_listing_media(integer,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;