BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE OR REPLACE FUNCTION public.valid_featured_offer(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE price numeric;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(value)) <> 2
    OR jsonb_typeof(value->'monthly_price_try') IS DISTINCT FROM 'number'
    OR jsonb_typeof(value->'description') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  price := (value->>'monthly_price_try')::numeric;
  RETURN price > 0 AND price <= 1000000 AND trunc(price,2)=price
    AND length(value->>'description') <= 400;
END; $$;
REVOKE ALL ON FUNCTION public.valid_featured_offer(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_featured_offer(jsonb) TO anon,authenticated;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS featured_offer jsonb NOT NULL
  DEFAULT '{"monthly_price_try":150,"description":"Vitrin ilanı vermek isteyenlerden 1 aylık yayın için bu ücret alınır. Başvuru için yöneticiyle iletişime geçin."}'::jsonb;
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_featured_offer_check;
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_featured_offer_check
  CHECK (public.valid_featured_offer(featured_offer));
-- Existing revision trigger, announcement/categories and admin RLS are retained.
GRANT UPDATE(featured_offer) ON public.site_settings TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;