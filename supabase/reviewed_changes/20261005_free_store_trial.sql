-- Candidate ONLY: verified encrypted backup and separate live SQL approval required.
-- Prerequisite: reviewed annual-unlimited upgrade. No listings/media/accounts are rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE private.store_plans ADD COLUMN IF NOT EXISTS trial_days integer;
ALTER TABLE private.store_requests ADD COLUMN IF NOT EXISTS trial_days integer;
ALTER TABLE private.store_memberships ADD COLUMN IF NOT EXISTS trial_days integer;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['store_plans','store_requests','store_memberships'] LOOP
    EXECUTE format('ALTER TABLE private.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_billing_period_check');
    EXECUTE format('ALTER TABLE private.%I ADD CONSTRAINT %I CHECK(billing_period IN(''month'',''year'',''trial''))',t,t||'_billing_period_check');
  END LOOP;
  FOREACH t IN ARRAY ARRAY['store_plans','store_requests'] LOOP
    EXECUTE format('ALTER TABLE private.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_billing_terms');
    EXECUTE format('ALTER TABLE private.%I ADD CONSTRAINT %I CHECK(
      (billing_period=''month'' AND monthly_price_try IS NOT NULL AND monthly_price_try>0 AND annual_price_try IS NULL
        AND monthly_limit IS NOT NULL AND monthly_limit>0 AND active_limit IS NOT NULL AND active_limit>0 AND trial_days IS NULL)
      OR (billing_period=''year'' AND annual_price_try IS NOT NULL AND annual_price_try>0 AND monthly_price_try IS NULL
        AND monthly_limit IS NULL AND active_limit IS NULL AND trial_days IS NULL)
      OR (billing_period=''trial'' AND monthly_price_try IS NULL AND annual_price_try IS NULL
        AND monthly_limit IS NULL AND active_limit IS NULL AND trial_days IS NOT NULL AND trial_days=30))',t,t||'_billing_terms');
  END LOOP;
END; $$;
ALTER TABLE private.store_memberships DROP CONSTRAINT IF EXISTS store_memberships_billing_capacity;
ALTER TABLE private.store_memberships ADD CONSTRAINT store_memberships_billing_capacity CHECK(
  (billing_period='month' AND monthly_limit IS NOT NULL AND monthly_limit>0 AND active_limit IS NOT NULL AND active_limit>0 AND trial_days IS NULL)
  OR (billing_period='year' AND monthly_limit IS NULL AND active_limit IS NULL AND trial_days IS NULL)
  OR (billing_period='trial' AND monthly_limit IS NULL AND active_limit IS NULL AND trial_days IS NOT NULL AND trial_days=30));
INSERT INTO private.store_plans(id,name,billing_period,monthly_price_try,annual_price_try,monthly_limit,active_limit,trial_days)
  VALUES('trial-30-days','30 Gün Ücretsiz Deneme','trial',NULL,NULL,NULL,NULL,30) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS private.store_trial_ledger(
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id),
  request_id uuid UNIQUE NOT NULL REFERENCES private.store_requests(id),
  starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at)
);
ALTER TABLE private.store_trial_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.store_trial_ledger FROM PUBLIC,anon,authenticated;
-- The existing paid upsert predates trial_days. Clear that marker on a later
-- paid activation without rewriting the permanent one-use ledger or history.
CREATE OR REPLACE FUNCTION private.clear_paid_membership_trial_days() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NEW.billing_period IN('month','year') THEN NEW.trial_days:=NULL;END IF;RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.clear_paid_membership_trial_days() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS store_paid_trial_marker_guard ON private.store_memberships;
CREATE TRIGGER store_paid_trial_marker_guard BEFORE INSERT OR UPDATE ON private.store_memberships
  FOR EACH ROW EXECUTE FUNCTION private.clear_paid_membership_trial_days();

-- Preserve the existing all-data implementation behind a private helper.
-- Public signatures remain; older clients cannot mistake a trial for paid membership.
DO $$ BEGIN
  IF to_regprocedure('private.store_membership_data_base(uuid)') IS NULL THEN
    ALTER FUNCTION public.get_store_membership_data_v2(uuid) SET SCHEMA private;
    ALTER FUNCTION private.get_store_membership_data_v2(uuid) RENAME TO store_membership_data_base;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION private.store_membership_data_base(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_store_membership_data_v3(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;catalog jsonb;mine jsonb;
BEGIN
  data:=private.store_membership_data_base(p_store_id);
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY CASE p.id WHEN 'package-1' THEN 1 WHEN 'package-2' THEN 2
    WHEN 'package-3' THEN 3 WHEN 'trial-30-days' THEN 4 ELSE 5 END,p.id),'[]') INTO catalog FROM private.store_plans p;
  data:=jsonb_set(data,'{plans}',catalog);mine:=data->'mine';
  IF mine IS NOT NULL AND mine<>'null'::jsonb THEN
    mine:=mine||jsonb_build_object('trial_used',EXISTS(SELECT 1 FROM private.store_trial_ledger WHERE owner_id=auth.uid()));
    data:=jsonb_set(data,'{mine}',mine);
  END IF;
  RETURN data;
END; $$;
REVOKE ALL ON FUNCTION public.get_store_membership_data_v3(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data_v3(uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_store_membership_data_v2(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;mine jsonb;filtered jsonb;
BEGIN
  data:=public.get_store_membership_data_v3(p_store_id);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'plans') WHERE value->>'billing_period'<>'trial';
  data:=jsonb_set(data,'{plans}',filtered);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'requests') WHERE value->>'billing_period'<>'trial';
  data:=jsonb_set(data,'{requests}',filtered);mine:=data->'mine';
  IF mine IS NOT NULL AND mine<>'null'::jsonb THEN
    SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(mine->'requests') WHERE value->>'billing_period'<>'trial';
    mine:=jsonb_set(mine,'{requests}',filtered)-'trial_used';
    IF mine->'membership'->>'billing_period'='trial' THEN mine:=jsonb_set(mine,'{membership}','null'::jsonb);END IF;
    data:=jsonb_set(data,'{mine}',mine);
  END IF;
  RETURN data;
END; $$;
REVOKE ALL ON FUNCTION public.get_store_membership_data_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data_v2(uuid) TO anon,authenticated;
-- Recompile the old wrapper after moving its former callee; avoid cached-OID ambiguity.
CREATE OR REPLACE FUNCTION public.get_store_membership_data(p_store_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;mine jsonb;filtered jsonb;
BEGIN
  data:=public.get_store_membership_data_v2(p_store_id);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'plans') WHERE value->>'billing_period'='month';
  data:=jsonb_set(data,'{plans}',filtered);
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(data->'requests') WHERE value->>'billing_period'='month';
  data:=jsonb_set(data,'{requests}',filtered);mine:=data->'mine';
  IF mine IS NOT NULL AND mine<>'null'::jsonb THEN
    SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(mine->'requests') WHERE value->>'billing_period'='month';
    mine:=jsonb_set(mine,'{requests}',filtered);
    IF mine->'membership'->>'billing_period'='year' THEN mine:=jsonb_set(mine,'{membership}','null'::jsonb);END IF;
    data:=jsonb_set(data,'{mine}',mine);
  END IF;RETURN data;
END; $$;
REVOKE ALL ON FUNCTION public.get_store_membership_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_membership_data(uuid) TO anon,authenticated;

-- The paid request endpoint cannot route a free trial through payment approval.
CREATE OR REPLACE FUNCTION private.guard_free_trial_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NEW.billing_period='trial' AND NEW.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_TRIAL_DIRECT_ONLY';
  END IF;RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_free_trial_request() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS store_free_trial_request_guard ON private.store_requests;
CREATE TRIGGER store_free_trial_request_guard BEFORE INSERT ON private.store_requests
  FOR EACH ROW EXECUTE FUNCTION private.guard_free_trial_request();

CREATE OR REPLACE FUNCTION public.start_store_trial(p_action text,p_id uuid,p_revision integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();ledger private.store_trial_ledger;request private.store_requests;
  plan private.store_plans;started timestamptz;finished timestamptz;store_name text;description text;
BEGIN
  IF uid IS NULL OR NOT public.is_verified_listing_submitter() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MEMBERSHIP_VERIFIED_REQUIRED';
  END IF;
  store_name:=btrim(coalesce(p_payload->>'store_name',''));description:=btrim(coalesce(p_payload->>'description',''));
  IF p_action IS DISTINCT FROM 'trial_start' OR p_id IS NULL OR p_revision IS NOT NULL
    OR p_payload->>'plan_id' IS DISTINCT FROM 'trial-30-days'
    OR length(store_name) NOT BETWEEN 2 AND 100 OR length(description)>500 THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  SELECT * INTO ledger FROM private.store_trial_ledger WHERE owner_id=uid;
  IF ledger.owner_id IS NOT NULL THEN
    SELECT * INTO request FROM private.store_requests WHERE id=ledger.request_id;
    IF ledger.request_id=p_id AND ledger.ends_at>now() AND request.store_name=store_name AND request.description=description
      AND EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=uid AND request_id=p_id
        AND billing_period='trial' AND starts_at<=now() AND ends_at>now()) THEN
      RETURN jsonb_build_object('ok',true,'id',p_id,'ends_at',ledger.ends_at);
    END IF;RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_TRIAL_USED';
  END IF;
  IF EXISTS(SELECT 1 FROM private.store_memberships WHERE owner_id=uid AND starts_at<=now() AND ends_at>now()) THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_ACTIVE';
  END IF;
  IF EXISTS(SELECT 1 FROM private.store_requests WHERE owner_id=uid AND status='pending') THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_PENDING';
  END IF;
  IF EXISTS(SELECT 1 FROM private.store_requests WHERE id=p_id) THEN RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_STALE';END IF;
  SELECT * INTO plan FROM private.store_plans WHERE id='trial-30-days';
  IF plan.billing_period IS DISTINCT FROM 'trial' OR plan.trial_days IS DISTINCT FROM 30
    OR plan.monthly_price_try IS NOT NULL OR plan.annual_price_try IS NOT NULL
    OR plan.monthly_limit IS NOT NULL OR plan.active_limit IS NOT NULL THEN
    RAISE EXCEPTION USING MESSAGE='MEMBERSHIP_INVALID';
  END IF;
  started:=clock_timestamp();finished:=((started AT TIME ZONE 'Europe/Istanbul')+interval '30 days') AT TIME ZONE 'Europe/Istanbul';
  INSERT INTO private.store_requests(id,owner_id,plan_id,plan_name,billing_period,trial_days,monthly_price_try,annual_price_try,
    monthly_limit,active_limit,store_name,description,status,decided_at)
    VALUES(p_id,uid,plan.id,plan.name,'trial',30,NULL,NULL,NULL,NULL,store_name,description,'approved',started);
  INSERT INTO private.store_trial_ledger(owner_id,request_id,starts_at,ends_at) VALUES(uid,p_id,started,finished);
  INSERT INTO private.member_stores(owner_id,name,description) VALUES(uid,store_name,description)
    ON CONFLICT(owner_id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,revision=private.member_stores.revision+1;
  INSERT INTO private.store_memberships(owner_id,request_id,plan_name,billing_period,trial_days,monthly_limit,active_limit,starts_at,ends_at)
    VALUES(uid,p_id,plan.name,'trial',30,NULL,NULL,started,finished)
    ON CONFLICT(owner_id) DO UPDATE SET request_id=EXCLUDED.request_id,plan_name=EXCLUDED.plan_name,billing_period='trial',
      trial_days=30,monthly_limit=NULL,active_limit=NULL,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
      revision=private.store_memberships.revision+1;
  RETURN jsonb_build_object('ok',true,'id',p_id,'ends_at',finished);
END; $$;
REVOKE ALL ON FUNCTION public.start_store_trial(text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_store_trial(text,uuid,integer,jsonb) TO authenticated;

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
    IF m.billing_period IN('year','trial') THEN
      RETURN jsonb_build_object('email_verified',verified,'unlimited',true,
        'period',CASE WHEN m.billing_period='trial' THEN 'membership_trial' ELSE 'membership_year' END,
        'limit',NULL,'used',used,'remaining',NULL,'monthly_remaining',NULL,'active_limit',NULL,
        'active_used',(slots->>'active')::int,'pending_reserved',(slots->>'pending')::int,
        'plan_name',m.plan_name,'next_available_at',NULL,'membership_ends_at',m.ends_at);
    END IF;
    remaining:=greatest(0,least(m.monthly_limit-used,m.active_limit-(slots->>'active')::int-(slots->>'pending')::int));
    RETURN jsonb_build_object('email_verified',verified,'unlimited',false,'period','membership_month','limit',m.monthly_limit,
      'used',used,'remaining',remaining,'monthly_remaining',greatest(0,m.monthly_limit-used),'active_limit',m.active_limit,
      'active_used',(slots->>'active')::int,'pending_reserved',(slots->>'pending')::int,'plan_name',m.plan_name,
      'next_available_at',NULL,'membership_ends_at',m.ends_at);
  END IF;
  IF verified THEN
    SELECT count(*),min(submitted_at)+interval '24 hours' INTO used,next_at FROM private.listing_submission_log
      WHERE user_id=uid AND submitted_at>now()-interval '24 hours';
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
