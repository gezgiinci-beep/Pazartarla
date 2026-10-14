-- Candidate only. Apply to production only after a verified encrypted backup,
-- a reviewed isolated-database test, and separate explicit approval.
-- This reversible control hides a store page; it never deletes stores, listings,
-- memberships, payment history, user accounts, or images.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $$
BEGIN
  IF to_regclass('private.member_stores') IS NULL OR
     to_regclass('private.store_memberships') IS NULL OR
     to_regprocedure('public.get_store_membership_data_v3(uuid)') IS NULL OR
     to_regprocedure('public.is_listing_admin()') IS NULL OR
     to_regprocedure('public.is_verified_listing_submitter()') IS NULL THEN
    RAISE EXCEPTION 'STORE_PUBLICATION_PREREQUISITES_MISSING';
  END IF;
END;
$$;

ALTER TABLE private.member_stores
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_store_membership_data_v4(p_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uid uuid := auth.uid();
  admin boolean := auth.uid() IS NOT NULL
    AND public.is_listing_admin()
    AND public.is_verified_listing_submitter();
  data jsonb;
  public_stores jsonb := '[]'::jsonb;
  admin_stores jsonb := '[]'::jsonb;
BEGIN
  data := public.get_store_membership_data_v3(p_store_id);

  SELECT coalesce(jsonb_agg(entry.value ORDER BY entry.value->>'name'), '[]'::jsonb)
    INTO public_stores
  FROM jsonb_array_elements(coalesce(data->'stores', '[]'::jsonb)) AS entry(value)
  JOIN private.member_stores s ON s.id::text = entry.value->>'id'
  WHERE s.is_public;
  data := jsonb_set(data, '{stores}', public_stores, true);

  IF p_store_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM private.member_stores s
    WHERE s.id = p_store_id AND s.is_public
  ) THEN
    data := jsonb_set(data, '{store}', 'null'::jsonb, true);
    data := jsonb_set(data, '{listings}', '[]'::jsonb, true);
  END IF;

  IF admin THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'revision', s.revision,
        'listing_ids', (
          SELECT coalesce(jsonb_agg(l.id ORDER BY l.created_at DESC), '[]'::jsonb)
          FROM public.listings l
          WHERE l.submitted_by = s.owner_id
            AND l.status = 'approved'
            AND l.expires_at > now()
        ),
        'is_public', s.is_public,
        'membership_ends_at', m.ends_at
      ) ORDER BY s.name
    ), '[]'::jsonb)
      INTO admin_stores
    FROM private.member_stores s
    JOIN private.store_memberships m ON m.owner_id = s.owner_id
    WHERE m.starts_at <= now() AND m.ends_at > now();
  END IF;

  RETURN data || jsonb_build_object('admin_stores', admin_stores);
END;
$$;
REVOKE ALL ON FUNCTION public.get_store_membership_data_v4(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data_v4(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_store_publication(
  p_id uuid,
  p_revision integer,
  p_is_public boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uid uuid := auth.uid();
  owner uuid;
  saved_revision integer;
BEGIN
  IF uid IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MEMBERSHIP_VERIFIED_REQUIRED';
  END IF;
  IF NOT public.is_listing_admin() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MEMBERSHIP_ADMIN_REQUIRED';
  END IF;
  IF p_id IS NULL OR p_revision IS NULL OR p_revision < 1 OR p_is_public IS NULL THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_PUBLICATION_INVALID';
  END IF;

  SELECT s.owner_id INTO owner
  FROM private.member_stores s
  WHERE s.id = p_id;
  IF owner IS NULL THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';
  END IF;

  -- Serialize with store edits and membership decisions for the same owner.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 0));
  UPDATE private.member_stores s
    SET is_public = p_is_public,
        revision = s.revision + CASE WHEN s.is_public IS DISTINCT FROM p_is_public THEN 1 ELSE 0 END
  WHERE s.id = p_id
    AND s.revision = p_revision
    AND EXISTS (
      SELECT 1 FROM private.store_memberships m
      WHERE m.owner_id = s.owner_id AND m.starts_at <= now() AND m.ends_at > now()
    )
  RETURNING s.revision INTO saved_revision;

  IF saved_revision IS NULL THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';
  END IF;

  RETURN jsonb_build_object('ok', true, 'is_public', p_is_public, 'revision', saved_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.set_store_publication(uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_store_publication(uuid, integer, boolean) TO authenticated;

COMMIT;
