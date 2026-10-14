-- Apply ONLY after backfill verification AND every serving frontend writer uses
-- the new contract (including the separate apex site; no unapproved deployment).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.listings WHERE gallery_paths IS NULL
    OR is_featured IS NULL OR image ~* '^(data|blob):'
    OR strpos(coalesce(seotags,''),'\n__PAZARTARLA_META_V1__:')>0) THEN
    RAISE EXCEPTION 'LISTING_MEDIA_BACKFILL_NOT_VERIFIED';
  END IF;
END; $$;
ALTER TABLE public.listings ALTER COLUMN gallery_paths SET DEFAULT '{}'::text[];
ALTER TABLE public.listings ALTER COLUMN gallery_paths SET NOT NULL;
ALTER TABLE public.listings ALTER COLUMN is_featured SET DEFAULT false;
ALTER TABLE public.listings ALTER COLUMN is_featured SET NOT NULL;
-- This also validates all old rows, rather than only trusting a receipt.
ALTER TABLE public.listings ADD CONSTRAINT listing_media_no_inline
CHECK(image !~* '^(data|blob):' AND strpos(coalesce(seotags,''),'\n__PAZARTARLA_META_V1__:')=0);
NOTIFY pgrst,'reload schema';
COMMIT;