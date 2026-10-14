-- Candidate only. Separate verified encrypted backup, review and live SQL approval required.
-- Prerequisite: 20261004_store_memberships.sql. Never run historic setup after this upgrade.
-- Existing plans, membership/payment snapshots, listings, accounts and media are not rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

ALTER TABLE private.store_plans
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'month' CHECK(billing_period IN('month','year')),
  ADD COLUMN IF NOT EXISTS annual_price_try numeric(12,2),
  ALTER COLUMN monthly_price_try DROP NOT NULL,
  ALTER COLUMN monthly_limit DROP NOT NULL,
  ALTER COLUMN active_limit DROP NOT NULL;
ALTER TABLE private.store_requests
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'month' CHECK(billing_period IN('month','year')),
  ADD COLUMN IF NOT EXISTS annual_price_try numeric(12,2),
  ALTER COLUMN monthly_price_try DROP NOT NULL,
  ALTER COLUMN monthly_limit DROP NOT NULL,
  ALTER COLUMN active_limit DROP NOT NULL;
ALTER TABLE private.store_memberships
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'month' CHECK(billing_period IN('month','year')),
  ALTER COLUMN monthly_limit DROP NOT NULL,
  ALTER COLUMN active_limit DROP NOT NULL;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['store_plans','store_requests'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conname=table_name||'_billing_terms' AND conrelid=('private.'||table_name)::regclass) THEN
      EXECUTE format('ALTER TABLE private.%I ADD CONSTRAINT %I CHECK (
        (billing_period=''month'' AND monthly_price_try IS NOT NULL AND monthly_price_try>0
          AND annual_price_try IS NULL AND monthly_limit IS NOT NULL AND monthly_limit>0
          AND active_limit IS NOT NULL AND active_limit>0)
        OR (billing_period=''year'' AND annual_price_try IS NOT NULL AND annual_price_try>0
          AND monthly_price_try IS NULL AND monthly_limit IS NULL AND active_limit IS NULL))',
        table_name,table_name||'_billing_terms');
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname='store_memberships_billing_capacity' AND conrelid='private.store_memberships'::regclass) THEN
    ALTER TABLE private.store_memberships ADD CONSTRAINT store_memberships_billing_capacity CHECK(
      (billing_period='month' AND monthly_limit IS NOT NULL AND monthly_limit>0 AND active_limit IS NOT NULL AND active_limit>0)
      OR (billing_period='year' AND monthly_limit IS NULL AND active_limit IS NULL));
  END IF;
END; $$;
INSERT INTO private.store_plans(id,name,monthly_price_try,annual_price_try,billing_period,monthly_limit,active_limit)
  VALUES('package-3','Paket 3',NULL,2500,'year',NULL,NULL) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_store_membership_data_v2(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();admin boolean:=public.is_listing_admin() AND public.is_verified_listing_submitter();
  catalog jsonb;shops jsonb;shop jsonb;rows jsonb:='[]';mine jsonb:=NULL;requests jsonb:='[]';
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.billing_period,coalesce(p.monthly_price_try,p.annual_price_try)),'[]')
    INTO catalog FROM private.store_plans p;
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
      'store',(SELECT jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'revision',s.revision,'listing_ids','[]'::jsonb)
        FROM private.member_stores s WHERE s.owner_id=uid),
      'membership',(SELECT to_jsonb(m)-'owner_id'-'request_id' FROM private.store_memberships m WHERE m.owner_id=uid),
      'requests',(SELECT coalesce(jsonb_agg(to_jsonb(r)-'owner_id'-'decided_by' ORDER BY r.created_at DESC),'[]')
        FROM private.store_requests r WHERE r.owner_id=uid)) INTO mine;
  END IF;
  IF admin THEN
    SELECT coalesce(jsonb_agg((to_jsonb(r)-'owner_id')||jsonb_build_object('email',u.email) ORDER BY r.created_at DESC),'[]')
      INTO requests FROM private.store_requests r JOIN auth.users u ON u.id=r.owner_id;
  END IF;
  RETURN jsonb_build_object('plans',catalog,'stores',shops,'store',shop,'listings',rows,'mine',mine,'requests',requests);
END; $$;
REVOKE ALL ON FUNCTION public.get_store_membership_data_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data_v2(uuid) TO anon,authenticated;

-- Old clients keep their two supported monthly plans and numeric snapshots.
-- They must not mislabel an annual 2,500 TL charge as a monthly charge.
CREATE OR REPLACE FUNCTION public.get_store_membership_data(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;mine jsonb;filtered jsonb;
BEGIN
  data:=public.get_store_membership_data_v2(p_store_id);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'plans')
    WHERE value->>'billing_period'='month';
  data:=jsonb_set(data,'{plans}',filtered);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'requests')
    WHERE value->>'billing_period'='month';
  data:=jsonb_set(data,'{requests}',filtered);
  mine:=data->'mine';
  IF mine IS NOT NULL AND mine<>'null'::jsonb THEN
    SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(mine->'requests')
      WHERE value->>'billing_period'='month';
    mine:=jsonb_set(mine,'{requests}',filtered);
    IF mine->'membership'->>'billing_period'='year' THEN mine:=jsonb_set(mine,'{membership}','null'::jsonb);END IF;
    data:=jsonb_set(data,'{mine}',mine);
  END IF;
  RETURN data;
END; $$;
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
    INSERT INTO private.store_requests(id,owner_id,plan_id,plan_name,monthly_price_try,annual_price_try,billing_period,
      monthly_limit,active_limit,store_name,description)
    VALUES(p_id,uid,plan.id,plan.name,plan.monthly_price_try,plan.annual_price_try,plan.billing_period,
      plan.monthly_limit,plan.active_limit,v_store_name,v_description);
  ELSIF p_action='store' THEN
    IF NOT EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now()) THEN
      RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
    v_store_name:=btrim(coalesce(p_payload->>'store_name',''));v_description:=btrim(coalesce(p_payload->>'description',''));
    IF length(v_store_name) NOT BETWEEN 2 AND 100 OR length(v_description)>500 THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';END IF;
    UPDATE private.member_stores SET name=v_store_name,description=v_description,revision=revision+1
      WHERE owner_id=uid AND revision=p_revision;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';END IF;
  ELSE
    SELECT * INTO r FROM private.store_requests WHERE id=p_id FOR UPDATE;
    ref:=upper(btrim(coalesce(p_payload->>'payment_reference','')));
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
      IF r.active_limit IS NOT NULL AND (slots->>'active')::int+(slots->>'pending')::int>r.active_limit THEN
        RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_ACTIVE_LIMIT';END IF;
      started:=clock_timestamp();
      finished:=((started AT TIME ZONE 'Europe/Istanbul')+
        CASE WHEN r.billing_period='year' THEN interval '1 year' ELSE interval '1 month' END) AT TIME ZONE 'Europe/Istanbul';
      INSERT INTO private.member_stores(owner_id,name,description) VALUES(owner,r.store_name,r.description)
        ON CONFLICT(owner_id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,revision=private.member_stores.revision+1;
      INSERT INTO private.store_memberships(owner_id,request_id,plan_name,billing_period,monthly_limit,active_limit,starts_at,ends_at)
        VALUES(owner,r.id,r.plan_name,r.billing_period,r.monthly_limit,r.active_limit,started,finished)
        ON CONFLICT(owner_id) DO UPDATE SET request_id=EXCLUDED.request_id,plan_name=EXCLUDED.plan_name,
          billing_period=EXCLUDED.billing_period,monthly_limit=EXCLUDED.monthly_limit,active_limit=EXCLUDED.active_limit,
          starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,revision=private.store_memberships.revision+1;
      INSERT INTO private.store_payment_log(reference,request_id,approved_by,amount_try)
        VALUES(ref,r.id,uid,CASE WHEN r.billing_period='year' THEN r.annual_price_try ELSE r.monthly_price_try END);
    END IF;
    UPDATE private.store_requests SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,
      revision=revision+1,decided_at=clock_timestamp(),decided_by=uid WHERE id=r.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',p_id);
END; $$;
REVOKE ALL ON FUNCTION public.manage_store_membership(text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_store_membership(text,uuid,integer,jsonb) TO authenticated;

-- Existing submission and moderation guards use numeric comparisons. NULL limits
-- are deliberately unbounded, restricted by the above annual-only constraints.
-- Those guards, admin checks, submission timestamps and expiry triggers stay intact.
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
    IF m.billing_period='year' THEN
      RETURN jsonb_build_object('email_verified',verified,'unlimited',true,'period','membership_year','limit',NULL,
        'used',used,'remaining',NULL,'monthly_remaining',NULL,'active_limit',NULL,'active_used',(slots->>'active')::int,
        'pending_reserved',(slots->>'pending')::int,'plan_name',m.plan_name,'next_available_at',NULL,'membership_ends_at',m.ends_at);
    END IF;
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
END; $$;
REVOKE ALL ON FUNCTION public.get_listing_submission_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_submission_quota() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
