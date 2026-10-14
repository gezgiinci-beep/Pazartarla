-- REVIEWED CHANGE, NOT AN AUTOMATIC MIGRATION OR APPLICATION STARTUP SCRIPT.
-- Requires a separate synthetic test, verified backup, and explicit live SQL approval.
-- Does not rewrite or remove existing listings, accounts, media, or membership data.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS private.listing_offer_settings (
  listing_id integer PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS private.listing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No FK to listings: retain the parties' agreement if an admin removes an ad.
  listing_id integer NOT NULL,
  title_snapshot text NOT NULL,
  seller_phone_snapshot text NOT NULL,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL CHECK (buyer_id <> seller_id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  counter_amount numeric(12,2),
  quantity text NOT NULL CHECK (length(quantity) BETWEEN 1 AND 80),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  buyer_phone text NOT NULL CHECK (length(buyer_phone) BETWEEN 10 AND 24),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','countered','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_offers_one_open_per_buyer
  ON private.listing_offers(listing_id,buyer_id) WHERE status IN ('pending','countered');
CREATE INDEX IF NOT EXISTS listing_offers_seller_time
  ON private.listing_offers(seller_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS listing_offers_buyer_time
  ON private.listing_offers(buyer_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS private.listing_offer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES private.listing_offers(id),
  actor_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS listing_offer_messages_offer_time
  ON private.listing_offer_messages(offer_id,created_at DESC);
ALTER TABLE private.listing_offer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.listing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.listing_offer_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.listing_offer_settings,private.listing_offers,private.listing_offer_messages
  FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.get_offer_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(l.id ORDER BY l.created_at DESC),'[]'::jsonb)
  FROM public.listings l
  JOIN private.listing_offer_settings s ON s.listing_id = l.id
  WHERE s.enabled AND l.status = 'approved' AND l.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.get_offer_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_offer_catalog() TO anon,authenticated;

CREATE FUNCTION public.get_my_offer_data() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  owner_ids jsonb := '[]';
  settings jsonb := '[]';
  offers jsonb := '[]';
  messages jsonb := '[]';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_LOGIN_REQUIRED';
  END IF;
  SELECT coalesce(jsonb_agg(l.id),'[]'::jsonb) INTO owner_ids
    FROM public.listings l WHERE l.submitted_by=uid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('listing_id',s.listing_id,'enabled',s.enabled)),'[]'::jsonb)
    INTO settings FROM private.listing_offer_settings s
    JOIN public.listings l ON l.id=s.listing_id WHERE l.submitted_by=uid;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'listing_id',o.listing_id,
    'title',coalesce(l.title,o.title_snapshot),
    'role',CASE WHEN o.buyer_id=uid THEN 'buyer' ELSE 'seller' END,
    'status',o.status,'amount',o.amount,'counter_amount',o.counter_amount,
    'quantity',o.quantity,'note',o.note,
    'buyer_phone',CASE WHEN o.status='accepted' THEN o.buyer_phone ELSE NULL END,
    'seller_phone',CASE WHEN o.status='accepted' THEN coalesce(nullif(l.phone,''),nullif(o.seller_phone_snapshot,'')) ELSE NULL END,
    'created_at',o.created_at,'updated_at',o.updated_at
  ) ORDER BY o.updated_at DESC),'[]'::jsonb) INTO offers
  FROM (
    SELECT * FROM private.listing_offers
      WHERE buyer_id=uid OR seller_id=uid
      ORDER BY updated_at DESC LIMIT 100
  ) o LEFT JOIN public.listings l ON l.id=o.listing_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'offer_id',m.offer_id,'actor',
    CASE WHEN m.actor_id=o.buyer_id THEN 'buyer' ELSE 'seller' END,
    'body',m.body,'created_at',m.created_at
  ) ORDER BY m.created_at ASC),'[]'::jsonb) INTO messages
  FROM (
    SELECT m.* FROM private.listing_offer_messages m
      JOIN private.listing_offers o ON o.id=m.offer_id
      WHERE o.status='accepted' AND (o.buyer_id=uid OR o.seller_id=uid)
      ORDER BY m.created_at DESC LIMIT 500
  ) m JOIN private.listing_offers o ON o.id=m.offer_id;
  RETURN jsonb_build_object('owner_ids',owner_ids,'settings',settings,
    'offers',offers,'messages',messages);
END; $$;
REVOKE ALL ON FUNCTION public.get_my_offer_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_offer_data() TO authenticated;

CREATE FUNCTION public.set_listing_offer_enabled(p_listing_id integer,p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item public.listings;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_LOGIN_REQUIRED';
  END IF;
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id FOR SHARE;
  IF NOT FOUND OR item.submitted_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_NOT_OWNER';
  END IF;
  IF p_enabled IS NULL OR (p_enabled AND
      (item.status NOT IN ('approved','pending') OR item.expires_at<=clock_timestamp())) THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_NOT_AVAILABLE';
  END IF;
  INSERT INTO private.listing_offer_settings(listing_id,enabled)
    VALUES(p_listing_id,p_enabled)
    ON CONFLICT(listing_id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=clock_timestamp();
  RETURN jsonb_build_object('ok',true,'enabled',p_enabled);
END; $$;
REVOKE ALL ON FUNCTION public.set_listing_offer_enabled(integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_listing_offer_enabled(integer,boolean) TO authenticated;

CREATE FUNCTION public.create_listing_offer(
  p_listing_id integer,p_amount numeric,p_quantity text,p_note text,p_buyer_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();item public.listings;new_id uuid;clean_phone text;
BEGIN
  IF uid IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_LOGIN_REQUIRED';
  END IF;
  IF p_amount IS NULL OR p_amount<0.01 OR p_amount>9999999999 OR p_amount<>round(p_amount,2) OR
    length(btrim(coalesce(p_quantity,''))) NOT BETWEEN 1 AND 80 OR
    length(btrim(coalesce(p_note,'')))>500 OR
    p_buyer_phone IS NULL OR p_buyer_phone !~ '^[+]?[0-9 ()-]{10,24}$' THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_INVALID';
  END IF;
  clean_phone:=regexp_replace(p_buyer_phone,'[^0-9]','','g');
  IF length(clean_phone) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_INVALID';
  END IF;
  -- Serialize a buyer's concurrent submissions before checking daily quota.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('offer:'||uid::text,0));
  IF (SELECT count(*) FROM private.listing_offers
      WHERE buyer_id=uid AND created_at>clock_timestamp()-interval '24 hours')>=10 THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_LIMIT';
  END IF;
  SELECT * INTO item FROM public.listings WHERE id=p_listing_id FOR SHARE;
  IF NOT FOUND OR item.submitted_by IS NULL OR item.submitted_by=uid OR
    item.status<>'approved' OR item.expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_NOT_AVAILABLE';
  END IF;
  PERFORM 1 FROM private.listing_offer_settings s
    WHERE s.listing_id=item.id AND s.enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='OFFER_NOT_AVAILABLE'; END IF;
  IF EXISTS (SELECT 1 FROM private.listing_offers
    WHERE listing_id=item.id AND buyer_id=uid AND status IN ('pending','countered')) THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_CONFLICT';
  END IF;
  INSERT INTO private.listing_offers(listing_id,title_snapshot,seller_phone_snapshot,seller_id,buyer_id,
    amount,quantity,note,buyer_phone)
  VALUES(item.id,item.title,coalesce(item.phone,''),item.submitted_by,uid,p_amount,btrim(p_quantity),
    btrim(coalesce(p_note,'')),p_buyer_phone)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok',true,'id',new_id,'status','pending');
END; $$;
REVOKE ALL ON FUNCTION public.create_listing_offer(integer,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_listing_offer(integer,numeric,text,text,text) TO authenticated;

CREATE FUNCTION public.respond_to_listing_offer(p_offer_id uuid,p_action text,p_amount numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item private.listing_offers;listing public.listings;next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_LOGIN_REQUIRED';
  END IF;
  SELECT * INTO item FROM private.listing_offers WHERE id=p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='OFFER_CONFLICT'; END IF;
  IF p_action IN ('accept','decline','counter') THEN
    IF item.seller_id<>auth.uid() OR item.status<>'pending' THEN
      RAISE EXCEPTION USING MESSAGE='OFFER_CONFLICT'; END IF;
  ELSIF p_action IN ('buyer_accept','buyer_decline') THEN
    IF item.buyer_id<>auth.uid() OR item.status<>'countered' THEN
      RAISE EXCEPTION USING MESSAGE='OFFER_CONFLICT'; END IF;
  ELSE RAISE EXCEPTION USING MESSAGE='OFFER_INVALID'; END IF;
  IF p_action NOT IN ('decline','buyer_decline') THEN
    SELECT * INTO listing FROM public.listings WHERE id=item.listing_id FOR SHARE;
    IF NOT FOUND OR listing.status<>'approved' OR listing.expires_at<=clock_timestamp() OR
      listing.submitted_by IS DISTINCT FROM item.seller_id THEN
      RAISE EXCEPTION USING MESSAGE='OFFER_NOT_AVAILABLE'; END IF;
  END IF;
  IF p_action='counter' AND (p_amount IS NULL OR p_amount<0.01 OR p_amount<>round(p_amount,2) OR
     p_amount>9999999999 OR p_amount=item.amount) THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_INVALID';
  END IF;
  next_status:=CASE WHEN p_action='counter' THEN 'countered'
    WHEN p_action IN ('accept','buyer_accept') THEN 'accepted'
    ELSE 'declined' END;
  UPDATE private.listing_offers SET status=next_status,
    counter_amount=CASE WHEN p_action='counter' THEN p_amount ELSE counter_amount END,
    updated_at=clock_timestamp() WHERE id=item.id;
  RETURN jsonb_build_object('ok',true,'status',next_status);
END; $$;
REVOKE ALL ON FUNCTION public.respond_to_listing_offer(uuid,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_listing_offer(uuid,text,numeric) TO authenticated;

CREATE FUNCTION public.send_listing_offer_message(p_offer_id uuid,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item private.listing_offers;message_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_LOGIN_REQUIRED';
  END IF;
  IF length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_INVALID';
  END IF;
  SELECT * INTO item FROM private.listing_offers WHERE id=p_offer_id FOR UPDATE;
  IF NOT FOUND OR item.status<>'accepted' OR auth.uid() NOT IN(item.buyer_id,item.seller_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='OFFER_NOT_AVAILABLE';
  END IF;
  IF (SELECT count(*) FROM private.listing_offer_messages
      WHERE offer_id=p_offer_id AND actor_id=auth.uid()
      AND created_at>clock_timestamp()-interval '24 hours')>=50 THEN
    RAISE EXCEPTION USING MESSAGE='OFFER_MESSAGE_LIMIT';
  END IF;
  INSERT INTO private.listing_offer_messages(offer_id,actor_id,body)
    VALUES(item.id,auth.uid(),btrim(p_body)) RETURNING id INTO message_id;
  RETURN jsonb_build_object('ok',true,'id',message_id);
END; $$;
REVOKE ALL ON FUNCTION public.send_listing_offer_message(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_listing_offer_message(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
