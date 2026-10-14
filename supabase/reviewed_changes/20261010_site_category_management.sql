-- Reviewed candidate only: installs the atomic preview/apply RPCs used by
-- CategoryManager. It does not alter any records until an administrator
-- explicitly applies a reviewed operation through the UI.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS private.site_category_previews (
  preview_token text PRIMARY KEY,
  expected_revision integer NOT NULL,
  operation jsonb NOT NULL,
  next_categories jsonb NOT NULL,
  affected_ids bigint[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE private.site_category_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.site_category_previews FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.site_category_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.lower(pg_catalog.translate(p_name, 'Iİı', 'iii'));
$$;
REVOKE ALL ON FUNCTION private.site_category_key(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.transform_site_categories(p_categories jsonb, p_operation jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_action text := p_operation ->> 'action';
  v_category text := p_operation ->> 'category';
  v_name text := p_operation ->> 'name';
  v_new_name text := p_operation ->> 'newName';
  v_target text := p_operation ->> 'targetCategory';
  v_target_name text := p_operation ->> 'targetName';
  v_source jsonb;
  v_destination jsonb;
  v_new_source jsonb;
  v_new_destination jsonb;
  v_match text;
  v_items text[];
  v_current_set text[];
  v_requested_set text[];
  v_categories jsonb := p_categories;
BEGIN
  IF p_operation IS NULL OR pg_catalog.jsonb_typeof(p_operation) <> 'object'
     OR v_action IS NULL OR v_action NOT IN ('add', 'rename', 'reorder', 'move', 'delete')
     OR v_category IS NULL OR NOT (p_categories ? v_category) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
  END IF;
  v_source := p_categories -> v_category;

  IF v_action = 'add' THEN
    IF pg_catalog.jsonb_typeof(p_operation -> 'names') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(p_operation -> 'names') NOT BETWEEN 1 AND 200
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.jsonb_array_elements(p_operation -> 'names') AS x(value)
         WHERE pg_catalog.jsonb_typeof(x.value) <> 'string'
            OR pg_catalog.length(x.value #>> '{}') NOT BETWEEN 1 AND 100
            OR (x.value #>> '{}') <> pg_catalog.btrim(x.value #>> '{}')
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    SELECT pg_catalog.array_agg(item) INTO v_items
    FROM pg_catalog.jsonb_array_elements_text(p_operation -> 'names') AS x(item);
    IF pg_catalog.cardinality(v_items) <> (SELECT pg_catalog.count(DISTINCT item) FROM pg_catalog.unnest(v_items) AS x(item))
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_source) AS old(item)
         JOIN pg_catalog.unnest(v_items) AS incoming(item) USING (item)
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_DUPLICATE';
    END IF;
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_category], v_source || (p_operation -> 'names'), false);

  ELSIF v_action = 'rename' THEN
    IF v_name IS NULL OR NOT (v_source @> pg_catalog.jsonb_build_array(v_name))
       OR v_new_name IS NULL OR pg_catalog.length(v_new_name) NOT BETWEEN 1 AND 100
       OR v_new_name <> pg_catalog.btrim(v_new_name) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    IF v_source @> pg_catalog.jsonb_build_array(v_new_name) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_DUPLICATE';
    END IF;
    SELECT pg_catalog.jsonb_agg(
      CASE WHEN x.value = pg_catalog.to_jsonb(v_name) THEN pg_catalog.to_jsonb(v_new_name) ELSE x.value END
      ORDER BY x.ordinality
    ) INTO v_new_source
    FROM pg_catalog.jsonb_array_elements(v_source) WITH ORDINALITY AS x(value, ordinality);
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_category], v_new_source, false);

  ELSIF v_action = 'reorder' THEN
    IF pg_catalog.jsonb_typeof(p_operation -> 'order') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(p_operation -> 'order') <> pg_catalog.jsonb_array_length(v_source)
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements(p_operation -> 'order') AS x(value)
         WHERE pg_catalog.jsonb_typeof(x.value) <> 'string'
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    SELECT pg_catalog.array_agg(item ORDER BY item COLLATE "C") INTO v_current_set
    FROM pg_catalog.jsonb_array_elements_text(v_source) AS x(item);
    SELECT pg_catalog.array_agg(item ORDER BY item COLLATE "C") INTO v_requested_set
    FROM pg_catalog.jsonb_array_elements_text(p_operation -> 'order') AS x(item);
    IF v_current_set IS DISTINCT FROM v_requested_set THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_category], p_operation -> 'order', false);

  ELSIF v_action = 'move' THEN
    IF v_name IS NULL OR NOT (v_source @> pg_catalog.jsonb_build_array(v_name))
       OR v_target IS NULL OR v_target = v_category OR NOT (p_categories ? v_target) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    IF pg_catalog.jsonb_array_length(v_source) < 2 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_LAST_OPTION';
    END IF;
    v_destination := p_categories -> v_target;
    SELECT item INTO v_match
    FROM pg_catalog.jsonb_array_elements_text(v_destination) AS x(item)
    WHERE private.site_category_key(item) = private.site_category_key(v_name)
    LIMIT 1;
    SELECT pg_catalog.jsonb_agg(x.value ORDER BY x.ordinality) INTO v_new_source
    FROM pg_catalog.jsonb_array_elements(v_source) WITH ORDINALITY AS x(value, ordinality)
    WHERE x.value <> pg_catalog.to_jsonb(v_name);
    v_new_destination := CASE WHEN v_match IS NULL THEN v_destination || pg_catalog.jsonb_build_array(v_name) ELSE v_destination END;
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_category], v_new_source, false);
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_target], v_new_destination, false);

  ELSIF v_action = 'delete' THEN
    IF v_name IS NULL OR NOT (v_source @> pg_catalog.jsonb_build_array(v_name)) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    IF pg_catalog.jsonb_array_length(v_source) < 2 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_LAST_OPTION';
    END IF;
    IF v_target IS NULL AND v_target_name IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
    END IF;
    IF v_target IS NOT NULL THEN
      IF NOT (p_categories ? v_target) OR v_target_name IS NULL
         OR NOT ((p_categories -> v_target) @> pg_catalog.jsonb_build_array(v_target_name))
         OR (v_target = v_category AND v_target_name = v_name) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
      END IF;
    END IF;
    SELECT pg_catalog.jsonb_agg(x.value ORDER BY x.ordinality) INTO v_new_source
    FROM pg_catalog.jsonb_array_elements(v_source) WITH ORDINALITY AS x(value, ordinality)
    WHERE x.value <> pg_catalog.to_jsonb(v_name);
    v_categories := pg_catalog.jsonb_set(v_categories, ARRAY[v_category], v_new_source, false);
  END IF;

  IF NOT public.valid_site_categories(v_categories) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
  END IF;
  RETURN v_categories;
END;
$$;
REVOKE ALL ON FUNCTION private.transform_site_categories(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_site_category_change(p_expected_revision integer, p_operation jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
SET statement_timeout = '20s'
AS $$
DECLARE
  v_settings public.site_settings%ROWTYPE;
  v_next jsonb;
  v_action text;
  v_category text;
  v_name text;
  v_ids bigint[] := ARRAY[]::bigint[];
  v_token text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin()
     OR NOT EXISTS (
       SELECT 1 FROM auth.users AS u
       WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
         AND NOT COALESCE(u.is_anonymous, false)
         AND pg_catalog.lower(u.email) = pg_catalog.lower(auth.jwt() ->> 'email')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CATEGORY_ADMIN_REQUIRED';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
  END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 'public' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'CATEGORY_SETTINGS_MISSING'; END IF;
  IF v_settings.revision <> p_expected_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
  END IF;

  LOCK TABLE public.listings IN SHARE MODE;
  v_next := private.transform_site_categories(v_settings.categories, p_operation);
  v_action := p_operation ->> 'action';
  v_category := p_operation ->> 'category';
  v_name := p_operation ->> 'name';
  IF v_action IN ('rename', 'move', 'delete') THEN
    SELECT COALESCE(pg_catalog.array_agg(l.id::bigint ORDER BY l.id), ARRAY[]::bigint[])
      INTO v_ids
    FROM public.listings AS l
    WHERE l.category = v_category AND l."subCategory" = v_name;
  END IF;
  IF v_action = 'delete' AND pg_catalog.cardinality(v_ids) > 0
     AND p_operation ->> 'targetCategory' IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CATEGORY_TRANSFER_REQUIRED';
  END IF;

  DELETE FROM private.site_category_previews WHERE expires_at <= clock_timestamp();
  v_token := pg_catalog.replace(gen_random_uuid()::text, '-', '')
      || pg_catalog.replace(gen_random_uuid()::text, '-', '');
  INSERT INTO private.site_category_previews(
    preview_token, expected_revision, operation, next_categories, affected_ids, expires_at
  ) VALUES (
    v_token, p_expected_revision, p_operation, v_next, v_ids, clock_timestamp() + interval '10 minutes'
  );

  RETURN pg_catalog.jsonb_build_object(
    'settings', pg_catalog.jsonb_build_object(
      'id', v_settings.id, 'announcement', v_settings.announcement,
      'categories', v_settings.categories, 'featured_offer', v_settings.featured_offer,
      'revision', v_settings.revision
    ),
    'next_categories', v_next,
    'affected_count', pg_catalog.cardinality(v_ids),
    'preview_token', v_token
  );
END;
$$;
REVOKE ALL ON FUNCTION public.preview_site_category_change(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_site_category_change(integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_site_category_change(
  p_expected_revision integer, p_operation jsonb, p_preview_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '3s'
SET statement_timeout = '20s'
AS $$
DECLARE
  v_settings public.site_settings%ROWTYPE;
  v_preview private.site_category_previews%ROWTYPE;
  v_next jsonb;
  v_ids bigint[] := ARRAY[]::bigint[];
  v_action text;
  v_category text;
  v_name text;
  v_destination_category text;
  v_destination_name text;
  v_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_listing_admin()
     OR NOT EXISTS (
       SELECT 1 FROM auth.users AS u
       WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
         AND NOT COALESCE(u.is_anonymous, false)
         AND pg_catalog.lower(u.email) = pg_catalog.lower(auth.jwt() ->> 'email')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CATEGORY_ADMIN_REQUIRED';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 1
     OR p_preview_token IS NULL OR p_preview_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CATEGORY_INVALID';
  END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 'public' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'CATEGORY_SETTINGS_MISSING'; END IF;
  IF v_settings.revision <> p_expected_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
  END IF;

  LOCK TABLE public.listings IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_preview
  FROM private.site_category_previews
  WHERE preview_token = p_preview_token AND expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND OR v_preview.expected_revision <> p_expected_revision
     OR v_preview.operation <> p_operation THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
  END IF;

  v_next := private.transform_site_categories(v_settings.categories, p_operation);
  IF v_next <> v_preview.next_categories THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
  END IF;
  v_action := p_operation ->> 'action';
  v_category := p_operation ->> 'category';
  v_name := p_operation ->> 'name';
  IF v_action IN ('rename', 'move', 'delete') THEN
    SELECT COALESCE(pg_catalog.array_agg(l.id::bigint ORDER BY l.id), ARRAY[]::bigint[])
      INTO v_ids
    FROM public.listings AS l
    WHERE l.category = v_category AND l."subCategory" = v_name;
  END IF;
  IF v_ids IS DISTINCT FROM v_preview.affected_ids THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
  END IF;

  IF pg_catalog.cardinality(v_ids) > 0 THEN
    IF v_action = 'rename' THEN
      v_destination_category := v_category;
      v_destination_name := p_operation ->> 'newName';
    ELSIF v_action = 'move' THEN
      v_destination_category := p_operation ->> 'targetCategory';
      SELECT item INTO v_destination_name
      FROM pg_catalog.jsonb_array_elements_text(v_next -> v_destination_category) AS x(item)
      WHERE private.site_category_key(item) = private.site_category_key(v_name)
      LIMIT 1;
    ELSIF v_action = 'delete' THEN
      v_destination_category := p_operation ->> 'targetCategory';
      v_destination_name := p_operation ->> 'targetName';
    END IF;

    IF v_destination_category IS NULL OR v_destination_name IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CATEGORY_TRANSFER_REQUIRED';
    END IF;
    UPDATE public.listings
    SET category = v_destination_category, "subCategory" = v_destination_name
    WHERE id = ANY(v_ids) AND category = v_category AND "subCategory" = v_name;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> pg_catalog.cardinality(v_ids) THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT';
    END IF;
  END IF;

  UPDATE public.site_settings
  SET categories = v_next
  WHERE id = 'public' AND revision = p_expected_revision
  RETURNING * INTO v_settings;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'CATEGORY_CONFLICT'; END IF;

  DELETE FROM private.site_category_previews WHERE preview_token = p_preview_token;
  RETURN pg_catalog.jsonb_build_object(
    'settings', pg_catalog.jsonb_build_object(
      'id', v_settings.id, 'announcement', v_settings.announcement,
      'categories', v_settings.categories, 'featured_offer', v_settings.featured_offer,
      'revision', v_settings.revision
    ),
    'affected_count', v_updated
  );
END;
$$;
REVOKE ALL ON FUNCTION public.apply_site_category_change(integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_site_category_change(integer, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
