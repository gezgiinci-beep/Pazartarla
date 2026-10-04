-- Reviewed maintenance only: not accepted by the automatic additive runner.
-- No existing row updates/backfill/deletes. Take a verified encrypted backup,
-- test separately, review function ownership, then explicitly approve application.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION private.assert_listing_editor(item public.listings)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR (
    NOT public.is_listing_admin() AND (
      item.submitted_by IS DISTINCT FROM auth.uid()
      OR NOT public.is_verified_listing_submitter()
      OR item.expires_at <= clock_timestamp()
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION private.assert_listing_editor(public.listings) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_listing_for_edit(p_listing_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE item public.listings;
BEGIN
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  PERFORM private.assert_listing_editor(item);
  RETURN jsonb_build_object('listing',to_jsonb(item),
    'edit_token',encode(sha256(convert_to(to_jsonb(item)::text,'UTF8')),'hex'));
END; $$;
REVOKE ALL ON FUNCTION public.get_listing_for_edit(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_listing_for_edit(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_listing_details(
  p_listing_id integer,p_changes jsonb,p_edit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE
  original public.listings;
  candidate public.listings;
  saved public.listings;
  settings jsonb;
  key text;
  changed boolean;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
  END IF;
  FOR key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF key<>ALL(ARRAY['title','price','category','subCategory','location','description','seller','phone']) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_FIELD_FORBIDDEN';
    END IF;
    IF key='price' THEN
      IF jsonb_typeof(p_changes->key)<>'number' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
      END IF;
    ELSIF jsonb_typeof(p_changes->key)<>'string' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
    END IF;
  END LOOP;
  SELECT * INTO original FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  PERFORM private.assert_listing_editor(original);
  IF p_edit_token IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(original)::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_EDIT_CONFLICT';
  END IF;
  candidate:=jsonb_populate_record(original,p_changes);
  IF coalesce(length(trim(candidate.title)),0) NOT BETWEEN 1 AND 200
    OR candidate.price IS NULL OR candidate.price < 0 OR candidate.price > 1000000000000
    OR coalesce(length(trim(candidate.seller)),0) NOT BETWEEN 1 AND 120
    OR coalesce(length(trim(candidate.phone)),0) NOT BETWEEN 5 AND 32
    OR coalesce(length(candidate.description),0)>5000
    OR coalesce(length(candidate.location),0)>200 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
  END IF;
  IF candidate.category IS DISTINCT FROM original.category OR candidate."subCategory" IS DISTINCT FROM original."subCategory" THEN
    SELECT categories INTO settings FROM public.site_settings WHERE id='public';
    IF settings IS NULL OR NOT (settings ? candidate.category)
      OR NOT coalesce((settings->candidate.category) ? candidate."subCategory",false) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_CATEGORY_INVALID';
    END IF;
  END IF;
  changed:=to_jsonb(candidate) IS DISTINCT FROM to_jsonb(original);
  IF NOT changed THEN
    RETURN jsonb_build_object('listing',to_jsonb(original),'changed',false,'reapproval_required',false);
  END IF;
  -- Only explicitly editable columns. Never replace the row, ownership, ID,
  -- original creation/expiry, gallery/featured metadata, mode or submission log.
  UPDATE public.listings SET
    title=candidate.title,price=candidate.price,category=candidate.category,
    "subCategory"=candidate."subCategory",location=candidate.location,
    description=candidate.description,seller=candidate.seller,phone=candidate.phone,
    status=CASE WHEN public.is_listing_admin() THEN original.status ELSE 'pending' END
  WHERE id=original.id RETURNING * INTO saved;
  RETURN jsonb_build_object('listing',to_jsonb(saved),'changed',true,
    'reapproval_required',NOT public.is_listing_admin());
END; $$;
REVOKE ALL ON FUNCTION public.update_listing_details(integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_listing_details(integer,jsonb,text) TO authenticated;
-- Preserve admin-only direct UPDATE/DELETE RLS; members use only this bounded RPC.
CREATE OR REPLACE FUNCTION public.get_listing_moderation_queue()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('listing',to_jsonb(l),
    'edit_token',encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex'))
    ORDER BY l.created_at,l.id),'[]'::jsonb)
    FROM public.listings l WHERE l.status='pending' AND l.expires_at>clock_timestamp());
END; $$;
REVOKE ALL ON FUNCTION public.get_listing_moderation_queue() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_listing_moderation_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_listing_snapshot(
  p_listing_id integer,p_decision text,p_edit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE item public.listings;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
  END IF;
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND OR item.status IS DISTINCT FROM 'pending' OR item.expires_at IS NULL OR item.expires_at<=clock_timestamp()
    OR p_edit_token IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(item)::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_EDIT_CONFLICT';
  END IF;
  item:=jsonb_populate_record(item,jsonb_build_object('status',p_decision));
  UPDATE public.listings SET status=item.status WHERE id=item.id RETURNING * INTO item;
  RETURN jsonb_build_object('listing',to_jsonb(item));
END; $$;
REVOKE ALL ON FUNCTION public.moderate_listing_snapshot(integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_listing_snapshot(integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_listing_media(
  p_listing_id integer,p_changes jsonb,p_edit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE item public.listings; key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_EDIT_FORBIDDEN';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_INVALID';
  END IF;
  FOR key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF key NOT IN ('image','seotags') OR jsonb_typeof(p_changes->key)<>'string'
      OR length(p_changes->>key)>20000000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='LISTING_EDIT_FIELD_FORBIDDEN';
    END IF;
  END LOOP;
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND OR p_edit_token IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(item)::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='LISTING_EDIT_CONFLICT';
  END IF;
  UPDATE public.listings SET
    image=CASE WHEN p_changes ? 'image' THEN p_changes->>'image' ELSE item.image END,
    seotags=CASE WHEN p_changes ? 'seotags' THEN p_changes->>'seotags' ELSE item.seotags END
  WHERE id=item.id RETURNING * INTO item;
  RETURN jsonb_build_object('listing',to_jsonb(item));
END; $$;
REVOKE ALL ON FUNCTION public.update_listing_media(integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_listing_media(integer,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;