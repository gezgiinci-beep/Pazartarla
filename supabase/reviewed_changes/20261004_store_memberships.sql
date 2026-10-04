-- Reviewed activation ONLY after verified encrypted backup and separate approval.
-- Prerequisites: verified/moderated submissions, admin exemptions, listing expiry.
-- No existing listings, contacts, accounts, photos or submission logs are rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE IF NOT EXISTS private.store_plans(
  id text PRIMARY KEY,name text NOT NULL,monthly_price_try numeric(12,2) NOT NULL CHECK(monthly_price_try>0),
  monthly_limit integer NOT NULL CHECK(monthly_limit>0),active_limit integer NOT NULL CHECK(active_limit>0)
);
INSERT INTO private.store_plans VALUES('package-1','Paket 1',350,30,100),('package-2','Paket 2',500,150,250)
  ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS private.member_stores(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid UNIQUE NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
  revision integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS private.store_requests(
  id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES auth.users(id),plan_id text NOT NULL REFERENCES private.store_plans(id),
  plan_name text NOT NULL,monthly_price_try numeric(12,2) NOT NULL,monthly_limit integer NOT NULL,active_limit integer NOT NULL,
  store_name text NOT NULL,description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),decided_at timestamptz,decided_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS store_requests_one_pending ON private.store_requests(owner_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS private.store_memberships(
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id),request_id uuid UNIQUE NOT NULL REFERENCES private.store_requests(id),
  plan_name text NOT NULL,monthly_limit integer NOT NULL,active_limit integer NOT NULL,
  starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,revision integer NOT NULL DEFAULT 1,
  CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS private.store_payment_log(
  reference text PRIMARY KEY,request_id uuid UNIQUE NOT NULL REFERENCES private.store_requests(id),
  approved_by uuid NOT NULL REFERENCES auth.users(id),amount_try numeric(12,2) NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.store_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.member_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.store_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.store_payment_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.store_plans,private.member_stores,private.store_requests,private.store_memberships,private.store_payment_log FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.store_slot_counts(p_owner uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'active',count(*) FILTER(WHERE status='approved'),
    'pending',count(*) FILTER(WHERE status='pending'))
  FROM public.listings
  WHERE submitted_by=p_owner AND status IN('approved','pending') AND expires_at>now();
$$;
REVOKE ALL ON FUNCTION private.store_slot_counts(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_store_membership_data(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();admin boolean:=public.is_listing_admin() AND public.is_verified_listing_submitter();catalog jsonb;shops jsonb;
  shop jsonb;rows jsonb:='[]';mine jsonb:=NULL;requests jsonb:='[]';
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.monthly_price_try),'[]') INTO catalog FROM private.store_plans p;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'revision',s.revision,
    'listing_ids',(SELECT coalesce(jsonb_agg(l.id ORDER BY l.created_at DESC),'[]') FROM public.listings l
      WHERE l.submitted_by=s.owner_id AND l.status='approved' AND l.expires_at>now())) ORDER BY s.name),'[]')
    INTO shops FROM private.member_stores s JOIN private.store_memberships m ON m.owner_id=s.owner_id
    WHERE m.starts_at<=now() AND m.ends_at>now();
  IF p_store_id IS NOT NULL THEN
    SELECT value INTO shop FROM jsonb_array_elements(shops) WHERE value->>'id'=p_store_id::text;
    IF shop IS NOT NULL THEN
      SELECT coalesce(jsonb_agg(to_jsonb(l)-'submitted_by' ORDER BY l.created_at DESC),'[]') INTO rows
        FROM public.listings l JOIN private.member_stores s ON s.owner_id=l.submitted_by
        WHERE s.id=p_store_id AND l.status='approved' AND l.expires_at>now();
    END IF;
  END IF;
  IF uid IS NOT NULL THEN
    SELECT jsonb_build_object(
      'store',(SELECT jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'revision',s.revision,'listing_ids','[]'::jsonb) FROM private.member_stores s WHERE s.owner_id=uid),
      'membership',(SELECT to_jsonb(m)-'owner_id'-'request_id' FROM private.store_memberships m WHERE m.owner_id=uid),
      'requests',(SELECT coalesce(jsonb_agg(to_jsonb(r)-'owner_id'-'decided_by' ORDER BY r.created_at DESC),'[]') FROM private.store_requests r WHERE r.owner_id=uid))
      INTO mine;
  END IF;
  IF admin THEN
    SELECT coalesce(jsonb_agg((to_jsonb(r)-'owner_id')||jsonb_build_object('email',u.email) ORDER BY r.created_at DESC),'[]')
      INTO requests FROM private.store_requests r JOIN auth.users u ON u.id=r.owner_id;
  END IF;
  RETURN jsonb_build_object('plans',catalog,'stores',shops,'store',shop,'listings',rows,'mine',mine,'requests',requests);
END;
$$;
REVOKE ALL ON FUNCTION public.get_store_membership_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.manage_store_membership(p_action text,p_id uuid,p_revision integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();r private.store_requests;plan private.store_plans;
  owner uuid;started timestamptz;finished timestamptz;ref text;slots jsonb;v_store_name text;v_description text;
BEGIN
  IF uid IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MEMBERSHIP_VERIFIED_REQUIRED';
  END IF;
  IF p_action IN('approve','reject') THEN
    IF NOT public.is_listing_admin() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MEMBERSHIP_ADMIN_REQUIRED';END IF;
    SELECT owner_id INTO owner FROM private.store_requests WHERE id=p_id;
    IF owner IS NULL THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';END IF;
  ELSIF p_action IN('request','store') THEN owner:=uid;
  ELSE RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
  -- Same lock as all submissions: request/approval/capacity decisions serialize.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text,0));
  IF p_action='request' THEN
    v_store_name:=btrim(coalesce(p_payload->>'store_name',''));v_description:=btrim(coalesce(p_payload->>'description',''));
    SELECT * INTO plan FROM private.store_plans WHERE id=p_payload->>'plan_id';
    IF p_id IS NULL OR plan.id IS NULL OR length(v_store_name) NOT BETWEEN 2 AND 100 OR length(v_description)>500 THEN
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
    SELECT * INTO r FROM private.store_requests WHERE id=p_id;
    IF r.id IS NOT NULL THEN
      IF r.owner_id=uid AND r.plan_id=plan.id AND r.store_name=v_store_name AND r.description=v_description THEN
        RETURN jsonb_build_object('ok',true,'id',r.id);END IF;
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';
    END IF;
    IF EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now()) THEN
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_ACTIVE';END IF;
    IF EXISTS(SELECT 1 FROM private.store_requests WHERE owner_id=uid AND status='pending') THEN
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_PENDING';END IF;
    INSERT INTO private.store_requests(id,owner_id,plan_id,plan_name,monthly_price_try,monthly_limit,active_limit,store_name,description)
      VALUES(p_id,uid,plan.id,plan.name,plan.monthly_price_try,plan.monthly_limit,plan.active_limit,v_store_name,v_description);
  ELSIF p_action='store' THEN
    IF NOT EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now()) THEN
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
    v_store_name:=btrim(coalesce(p_payload->>'store_name',''));v_description:=btrim(coalesce(p_payload->>'description',''));
    IF length(v_store_name) NOT BETWEEN 2 AND 100 OR length(v_description)>500 THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
    UPDATE private.member_stores SET name=v_store_name,description=v_description,revision=revision+1 WHERE owner_id=uid AND revision=p_revision;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';END IF;
  ELSE
    SELECT * INTO r FROM private.store_requests WHERE id=p_id FOR UPDATE;
    ref:=upper(btrim(coalesce(p_payload->>'payment_reference','')));
    -- Lost acknowledgment may be retried, but cannot start/extend another period.
    IF p_action='approve' AND r.status='approved' AND EXISTS(
      SELECT 1 FROM private.store_payment_log WHERE request_id=r.id AND reference=ref) THEN
      RETURN jsonb_build_object('ok',true,'id',r.id);
    END IF;
    IF r.status<>'pending' OR p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';END IF;
    IF p_action='approve' THEN
      IF p_payload->>'payment_confirmed' IS DISTINCT FROM 'true' OR length(ref) NOT BETWEEN 6 AND 120 THEN
        RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_PAYMENT_REQUIRED';END IF;
      IF EXISTS(SELECT 1 FROM private.store_payment_log WHERE reference=ref) THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_PAYMENT_USED';END IF;
      IF EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=owner AND starts_at<=now() AND ends_at>now()) THEN
        RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_ACTIVE';END IF;
      IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=owner AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN
        RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_VERIFIED_REQUIRED';END IF;
      slots:=private.store_slot_counts(owner);
      IF (slots->>'active')::int+(slots->>'pending')::int>r.active_limit THEN
        RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_ACTIVE_LIMIT';END IF;
      started:=clock_timestamp();
      finished:=((started AT TIME ZONE 'Europe/Istanbul')+interval '1 month') AT TIME ZONE 'Europe/Istanbul';
      INSERT INTO private.member_stores(owner_id,name,description) VALUES(owner,r.store_name,r.description)
        ON CONFLICT(owner_id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,revision=private.member_stores.revision+1;
      INSERT INTO private.store_memberships(owner_id,request_id,plan_name,monthly_limit,active_limit,starts_at,ends_at)
        VALUES(owner,r.id,r.plan_name,r.monthly_limit,r.active_limit,started,finished)
        ON CONFLICT(owner_id) DO UPDATE SET request_id=EXCLUDED.request_id,plan_name=EXCLUDED.plan_name,
          monthly_limit=EXCLUDED.monthly_limit,active_limit=EXCLUDED.active_limit,starts_at=EXCLUDED.starts_at,
          ends_at=EXCLUDED.ends_at,revision=private.store_memberships.revision+1;
      INSERT INTO private.store_payment_log(reference,request_id,approved_by,amount_try) VALUES(ref,r.id,uid,r.monthly_price_try);
    END IF;
    UPDATE private.store_requests SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,
      revision=revision+1,decided_at=clock_timestamp(),decided_by=uid WHERE id=r.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.manage_store_membership(text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_store_membership(text,uuid,integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_listing_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();m private.store_memberships;used integer;slots jsonb;
BEGIN
  IF uid IS NULL OR NOT public.is_verified_listing_submitter() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_VERIFIED_ACCOUNT_REQUIRED';END IF;
  IF NEW.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='LISTING_APPROVAL_REQUIRED';END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  IF NOT public.is_listing_admin() THEN
    SELECT * INTO m FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now();
    IF m.owner_id IS NOT NULL THEN
      SELECT count(*) INTO used FROM private.listing_submission_log WHERE user_id=uid AND submitted_at>=m.starts_at AND submitted_at<m.ends_at;
      IF used>=m.monthly_limit THEN RAISE EXCEPTION USING MESSAGE='LISTING_MONTHLY_LIMIT_REACHED';END IF;
      slots:=private.store_slot_counts(uid);
      IF (slots->>'active')::int+(slots->>'pending')::int>=m.active_limit THEN RAISE EXCEPTION USING MESSAGE='LISTING_ACTIVE_LIMIT_REACHED';END IF;
    ELSE
      SELECT count(*) INTO used FROM private.listing_submission_log WHERE user_id=uid AND submitted_at>clock_timestamp()-interval '24 hours';
      IF used>=3 THEN RAISE EXCEPTION USING MESSAGE='LISTING_DAILY_LIMIT_REACHED';END IF;
    END IF;
  END IF;
  NEW.submitted_by:=uid;NEW.created_at:=clock_timestamp();RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_listing_submission() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.enforce_store_approval_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.store_memberships;active_count integer;
BEGIN
  -- Stored generated expires_at is unavailable in BEFORE UPDATE. Derive the
  -- same expiry from immutable created_at; NULL would silently skip this guard.
  IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.submitted_by IS NOT NULL
    AND (((NEW.created_at AT TIME ZONE 'Europe/Istanbul')+interval '8 months') AT TIME ZONE 'Europe/Istanbul')>now() THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.submitted_by::text,0));
    -- Admin's own submissions remain unlimited; moderator identity is not owner.
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

CREATE OR REPLACE FUNCTION public.get_listing_submission_quota() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();verified boolean:=public.is_verified_listing_submitter();
  unlimited boolean:=verified AND public.is_listing_admin();m private.store_memberships;
  used integer:=0;next_at timestamptz;slots jsonb;remaining integer;
BEGIN
  IF verified AND NOT unlimited THEN
    SELECT * INTO m FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now();
  END IF;
  IF m.owner_id IS NOT NULL THEN
    SELECT count(*) INTO used FROM private.listing_submission_log WHERE user_id=uid AND submitted_at>=m.starts_at AND submitted_at<m.ends_at;
    slots:=private.store_slot_counts(uid);
    remaining:=greatest(0,least(m.monthly_limit-used,m.active_limit-(slots->>'active')::int-(slots->>'pending')::int));
    RETURN jsonb_build_object('email_verified',verified,'unlimited',false,'period','membership_month','limit',m.monthly_limit,
      'used',used,'remaining',remaining,'monthly_remaining',greatest(0,m.monthly_limit-used),'active_limit',m.active_limit,
      'active_used',(slots->>'active')::int,'pending_reserved',(slots->>'pending')::int,'plan_name',m.plan_name,
      'next_available_at',NULL,'membership_ends_at',m.ends_at);
  END IF;
  IF verified THEN
    SELECT count(*),min(submitted_at)+interval '24 hours' INTO used,next_at
      FROM private.listing_submission_log WHERE user_id=uid AND submitted_at>now()-interval '24 hours';
  END IF;
  RETURN jsonb_build_object('email_verified',verified,'unlimited',unlimited,'period','rolling_day',
    'limit',CASE WHEN unlimited THEN NULL ELSE 3 END,'used',used,
    'remaining',CASE WHEN unlimited THEN NULL WHEN verified THEN greatest(0,3-used) ELSE 0 END,
    'next_available_at',CASE WHEN NOT unlimited AND used>=3 THEN next_at ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.get_listing_submission_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_submission_quota() TO anon,authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';