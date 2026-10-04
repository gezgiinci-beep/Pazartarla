BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE TABLE IF NOT EXISTS private.depot_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),identity_key text NOT NULL UNIQUE,
  name text NOT NULL,email text,phone text,raw_phone text,
  manual boolean NOT NULL DEFAULT false,from_listing boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(length(name) BETWEEN 1 AND 120),
  CHECK(email IS NULL OR (length(email)<=254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  CHECK(phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE TABLE IF NOT EXISTS private.depot_sources (
  listing_id bigint PRIMARY KEY,contact_id uuid NOT NULL REFERENCES private.depot_contacts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS depot_sources_contact_idx ON private.depot_sources(contact_id);
CREATE TABLE IF NOT EXISTS private.depot_permissions (
  contact_id uuid NOT NULL REFERENCES private.depot_contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK(channel IN ('sms','email','whatsapp')),
  status text NOT NULL DEFAULT 'unknown' CHECK(status IN ('unknown','granted','revoked')),
  evidence text NOT NULL DEFAULT '',updated_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  PRIMARY KEY(contact_id,channel)
);
CREATE TABLE IF NOT EXISTS private.depot_permission_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES private.depot_contacts(id) ON DELETE CASCADE,
  channel text NOT NULL,status text NOT NULL,evidence text NOT NULL,actor uuid,recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS private.depot_optout_links (
  token uuid PRIMARY KEY,channel text NOT NULL,destination text NOT NULL
);
CREATE TABLE IF NOT EXISTS private.depot_channels (
  channel text PRIMARY KEY CHECK(channel IN ('sms','email','whatsapp')),
  provider text,enabled boolean NOT NULL DEFAULT false,CHECK(NOT enabled OR provider IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS private.depot_suppressions (
  channel text NOT NULL,destination text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel,destination)
);
INSERT INTO private.depot_channels(channel) VALUES('sms'),('email'),('whatsapp') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS private.depot_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,channel text NOT NULL,
  subject text NOT NULL DEFAULT '',body text NOT NULL,scheduled_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('blocked_provider','queued','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),created_by uuid
);
CREATE TABLE IF NOT EXISTS private.depot_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES private.depot_campaigns(id),
  contact_id uuid NOT NULL REFERENCES private.depot_contacts(id),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','sent','failed','unknown','cancelled')),
  lease uuid,lease_until timestamptz,provider_id text,updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,destination)
);
CREATE INDEX IF NOT EXISTS depot_delivery_queue_idx ON private.depot_deliveries(status,campaign_id);
CREATE INDEX IF NOT EXISTS depot_delivery_contact_idx ON private.depot_deliveries(contact_id,status);
ALTER TABLE private.depot_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_permission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_optout_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.depot_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.depot_contacts,private.depot_sources,private.depot_permissions,
  private.depot_permission_events,private.depot_optout_links,private.depot_channels,private.depot_suppressions,private.depot_campaigns,private.depot_deliveries
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.depot_phone(raw text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE p text;
BEGIN
  IF raw IS NULL OR raw !~ '^[+0-9 ()-]*$' THEN RETURN NULL; END IF;
  p:=regexp_replace(raw,'[ ()-]','','g');
  IF p ~ '^00' THEN p:='+'||substr(p,3); END IF;
  IF p ~ '^0[1-9][0-9]{9}$' THEN p:='+90'||substr(p,2);
  ELSIF p ~ '^[1-9][0-9]{9}$' THEN p:='+90'||p;
  ELSIF p ~ '^90[1-9][0-9]{9}$' THEN p:='+'||p; END IF;
  RETURN CASE WHEN p ~ '^\+[1-9][0-9]{7,14}$' THEN p ELSE NULL END;
END; $$;
CREATE OR REPLACE FUNCTION private.depot_initialize_permissions(cid uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO private.depot_permissions(contact_id,channel)
    SELECT cid,unnest(ARRAY['sms','email','whatsapp']) ON CONFLICT DO NOTHING;
  INSERT INTO private.depot_optout_links(token,channel,destination)
    SELECT p.unsubscribe_token,p.channel,CASE WHEN p.channel='email' THEN c.email ELSE c.phone END
      FROM private.depot_permissions p JOIN private.depot_contacts c ON c.id=p.contact_id
      WHERE c.id=cid AND CASE WHEN p.channel='email' THEN c.email IS NOT NULL ELSE c.phone IS NOT NULL END
    ON CONFLICT DO NOTHING;
$$;
CREATE OR REPLACE FUNCTION private.capture_depot_listing(lid bigint,uid uuid,seller text,raw text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e text;p text;cid uuid;k text;
BEGIN
  -- Only the verified recorded submitter supplies email. Never infer email from phone/name.
  -- Admin submissions may be on behalf of another seller; do not copy admin identities.
  SELECT lower(u.email) INTO e FROM auth.users u WHERE u.id=uid AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM private.listing_admins a WHERE a.email=lower(u.email));
  p:=private.depot_phone(raw);
  IF e IS NULL AND nullif(trim(raw),'') IS NULL THEN RETURN NULL; END IF;
  k:=jsonb_build_array(e,coalesce(p,left(coalesce(raw,''),40)))::text;
  INSERT INTO private.depot_contacts(identity_key,name,email,phone,raw_phone,from_listing)
    VALUES(k,left(coalesce(nullif(trim(seller),''),'İlan veren'),120),e,p,left(raw,40),true)
    ON CONFLICT(identity_key) DO UPDATE SET
      name=CASE WHEN private.depot_contacts.manual THEN private.depot_contacts.name ELSE EXCLUDED.name END,
      raw_phone=CASE WHEN private.depot_contacts.manual THEN private.depot_contacts.raw_phone ELSE EXCLUDED.raw_phone END,
      from_listing=true,revision=private.depot_contacts.revision+1,updated_at=now()
    RETURNING id INTO cid;
  PERFORM private.depot_initialize_permissions(cid);
  INSERT INTO private.depot_sources(listing_id,contact_id) VALUES(lid,cid)
    ON CONFLICT(listing_id) DO UPDATE SET contact_id=EXCLUDED.contact_id,captured_at=now();
  RETURN cid;
END; $$;
CREATE OR REPLACE FUNCTION private.depot_listing_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.capture_depot_listing(NEW.id,NEW.submitted_by,NEW.seller,NEW.phone);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pazartarla_contact_capture ON public.listings;
CREATE TRIGGER pazartarla_contact_capture AFTER INSERT OR UPDATE OF seller,phone,submitted_by ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.depot_listing_trigger();
REVOKE ALL ON FUNCTION private.depot_phone(text),private.depot_initialize_permissions(uuid),
  private.capture_depot_listing(bigint,uuid,text,text),private.depot_listing_trigger() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.depot_assert_admin() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_listing_admin() THEN RAISE EXCEPTION 'CONTACT_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  -- Serialize admin contact mutations before taking any individual contact locks.
  PERFORM pg_advisory_xact_lock(713,714);
END; $$;
CREATE OR REPLACE FUNCTION private.depot_revoke(cid uuid,ch text,proof text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dest text;
BEGIN
  IF proof IN ('admin_revoked','self_service_link','contact_archived') THEN
    SELECT CASE WHEN ch='email' THEN email ELSE phone END INTO dest FROM private.depot_contacts WHERE id=cid;
    IF dest IS NOT NULL THEN
      INSERT INTO private.depot_suppressions(channel,destination) VALUES(ch,dest) ON CONFLICT DO NOTHING;
      INSERT INTO private.depot_permission_events(contact_id,channel,status,evidence,actor)
        SELECT c.id,ch,'revoked',proof,auth.uid() FROM private.depot_contacts c
        WHERE CASE WHEN ch='email' THEN c.email ELSE c.phone END=dest AND c.id<>cid;
      UPDATE private.depot_permissions p SET status='revoked',evidence='destination_optout',updated_at=now()
        FROM private.depot_contacts c WHERE p.contact_id=c.id AND p.channel=ch AND
          CASE WHEN ch='email' THEN c.email ELSE c.phone END=dest;
      UPDATE private.depot_contacts SET revision=revision+1,updated_at=now() WHERE id<>cid AND
        CASE WHEN ch='email' THEN email ELSE phone END=dest;
      UPDATE private.depot_deliveries d SET status='cancelled',updated_at=now()
        FROM private.depot_campaigns c WHERE c.id=d.campaign_id AND c.channel=ch
          AND d.destination=dest AND d.status='queued';
    END IF;
  END IF;
  UPDATE private.depot_permissions SET status='revoked',evidence=proof,updated_at=now()
    WHERE contact_id=cid AND channel=ch;
  INSERT INTO private.depot_permission_events(contact_id,channel,status,evidence,actor)
    VALUES(cid,ch,'revoked',proof,auth.uid());
  UPDATE private.depot_deliveries d SET status='cancelled',updated_at=now()
    FROM private.depot_campaigns c WHERE c.id=d.campaign_id AND d.contact_id=cid AND c.channel=ch AND d.status='queued';
END; $$;
REVOKE ALL ON FUNCTION private.depot_assert_admin(),private.depot_revoke(uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_depot_contact(
  p_id uuid,p_revision integer,p_name text,p_email text,p_phone text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e text:=nullif(lower(trim(p_email)),'');p text:=private.depot_phone(p_phone);
  cid uuid;old private.depot_contacts%ROWTYPE;k text;
BEGIN
  PERFORM private.depot_assert_admin();
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 120 OR
    (e IS NULL AND nullif(trim(p_phone),'') IS NULL) OR
    (e IS NOT NULL AND (length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) OR
    (nullif(trim(p_phone),'') IS NOT NULL AND (p IS NULL OR length(p_phone)>40)) THEN
    RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023';
  END IF;
  k:=jsonb_build_array(e,coalesce(p,''))::text;
  IF p_id IS NULL THEN
    INSERT INTO private.depot_contacts(identity_key,name,email,phone,raw_phone,manual)
      VALUES(k,trim(p_name),e,p,nullif(trim(p_phone),''),true) RETURNING id INTO cid;
  ELSE
    SELECT * INTO old FROM private.depot_contacts WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR p_revision IS NULL OR old.revision<>p_revision THEN
      RAISE EXCEPTION 'CONTACT_STALE' USING ERRCODE='40001'; END IF;
    UPDATE private.depot_contacts SET identity_key=k,name=trim(p_name),email=e,phone=p,
      raw_phone=nullif(trim(p_phone),''),manual=true,revision=revision+1,updated_at=now() WHERE id=p_id;
    IF old.email IS DISTINCT FROM e THEN
      PERFORM private.depot_revoke(p_id,'email','destination_changed');
      UPDATE private.depot_permissions SET unsubscribe_token=gen_random_uuid() WHERE contact_id=p_id AND channel='email';
    END IF;
    IF old.phone IS DISTINCT FROM p THEN
      PERFORM private.depot_revoke(p_id,'sms','destination_changed');
      PERFORM private.depot_revoke(p_id,'whatsapp','destination_changed');
      UPDATE private.depot_permissions SET unsubscribe_token=gen_random_uuid() WHERE contact_id=p_id AND channel IN ('sms','whatsapp');
    END IF;
    cid:=p_id;
  END IF;
  PERFORM private.depot_initialize_permissions(cid);RETURN cid;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'CONTACT_CONFLICT' USING ERRCODE='23505';
END; $$;

CREATE OR REPLACE FUNCTION public.set_depot_permission(
  p_id uuid,p_revision integer,p_channel text,p_grant boolean,p_evidence text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.depot_contacts%ROWTYPE;
BEGIN
  PERFORM private.depot_assert_admin();
  SELECT * INTO c FROM private.depot_contacts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR c.revision<>p_revision THEN RAISE EXCEPTION 'CONTACT_STALE' USING ERRCODE='40001'; END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('sms','email','whatsapp') OR p_grant IS NULL THEN
    RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  IF p_grant AND (c.archived OR (p_channel='email' AND c.email IS NULL) OR (p_channel<>'email' AND c.phone IS NULL)) THEN
    RAISE EXCEPTION 'CONTACT_DESTINATION_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_grant AND (p_evidence IS NULL OR length(trim(p_evidence)) NOT BETWEEN 3 AND 500) THEN
    RAISE EXCEPTION 'CONTACT_EVIDENCE_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_grant THEN
    DELETE FROM private.depot_suppressions WHERE channel=p_channel AND destination=
      CASE WHEN p_channel='email' THEN c.email ELSE c.phone END;
    UPDATE private.depot_permissions SET status='granted',evidence=trim(p_evidence),updated_at=now()
      WHERE contact_id=p_id AND channel=p_channel;
    INSERT INTO private.depot_permission_events(contact_id,channel,status,evidence,actor)
      VALUES(p_id,p_channel,'granted',trim(p_evidence),auth.uid());
  ELSE PERFORM private.depot_revoke(p_id,p_channel,'admin_revoked'); END IF;
  UPDATE private.depot_contacts SET revision=revision+1,updated_at=now() WHERE id=p_id;RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.archive_depot_contact(p_id uuid,p_revision integer,p_archived boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.depot_contacts%ROWTYPE;ch text;
BEGIN
  PERFORM private.depot_assert_admin();
  SELECT * INTO c FROM private.depot_contacts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR c.revision<>p_revision THEN RAISE EXCEPTION 'CONTACT_STALE' USING ERRCODE='40001'; END IF;
  IF p_archived IS NULL THEN RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  IF p_archived THEN
    FOREACH ch IN ARRAY ARRAY['sms','email','whatsapp'] LOOP PERFORM private.depot_revoke(p_id,ch,'contact_archived'); END LOOP;
  END IF;
  UPDATE private.depot_contacts SET archived=p_archived,revision=revision+1,updated_at=now() WHERE id=p_id;RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.unsubscribe_depot_contact(p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid;ch text;dest text;
BEGIN
  PERFORM pg_advisory_xact_lock(713,714);
  SELECT channel,destination INTO ch,dest FROM private.depot_optout_links WHERE token=p_token;
  IF dest IS NULL THEN RAISE EXCEPTION 'CONTACT_INVALID_UNSUBSCRIBE' USING ERRCODE='22023'; END IF;
  INSERT INTO private.depot_suppressions(channel,destination) VALUES(ch,dest) ON CONFLICT DO NOTHING;
  SELECT id INTO cid FROM private.depot_contacts WHERE CASE WHEN ch='email' THEN email ELSE phone END=dest ORDER BY id LIMIT 1 FOR UPDATE;
  IF cid IS NOT NULL THEN
    PERFORM private.depot_revoke(cid,ch,'self_service_link');
    UPDATE private.depot_contacts SET revision=revision+1,updated_at=now() WHERE id=cid;
  ELSE
    UPDATE private.depot_deliveries d SET status='cancelled',updated_at=now()
      FROM private.depot_campaigns c WHERE c.id=d.campaign_id AND c.channel=ch AND d.destination=dest AND d.status='queued';
  END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_depot_campaign(
  p_name text,p_channel text,p_subject text,p_body text,p_scheduled_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid;n integer;state text;
BEGIN
  PERFORM private.depot_assert_admin();
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 120 OR
    p_channel IS NULL OR p_channel NOT IN ('sms','email','whatsapp') OR
    p_body IS NULL OR length(trim(p_body)) NOT BETWEEN 1 AND 2000 OR
    length(coalesce(p_subject,''))>200 OR (p_channel='email' AND nullif(trim(p_subject),'') IS NULL) OR
    p_scheduled_at IS NULL OR p_scheduled_at<now()-interval '5 minutes' OR p_scheduled_at>now()+interval '90 days' THEN
    RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  SELECT CASE WHEN enabled THEN 'queued' ELSE 'blocked_provider' END INTO state
    FROM private.depot_channels WHERE channel=p_channel;
  INSERT INTO private.depot_campaigns(name,channel,subject,body,scheduled_at,status,created_by)
    VALUES(trim(p_name),p_channel,coalesce(trim(p_subject),''),trim(p_body),p_scheduled_at,state,auth.uid()) RETURNING id INTO cid;
  INSERT INTO private.depot_deliveries(campaign_id,contact_id,destination)
    SELECT DISTINCT ON(CASE WHEN p_channel='email' THEN c.email ELSE c.phone END)
      cid,c.id,CASE WHEN p_channel='email' THEN c.email ELSE c.phone END
    FROM private.depot_contacts c JOIN private.depot_permissions p ON p.contact_id=c.id AND p.channel=p_channel
    WHERE NOT c.archived AND p.status='granted' AND
      CASE WHEN p_channel='email' THEN c.email IS NOT NULL ELSE c.phone IS NOT NULL END
      AND NOT EXISTS(SELECT 1 FROM private.depot_suppressions s WHERE s.channel=p_channel AND
        s.destination=CASE WHEN p_channel='email' THEN c.email ELSE c.phone END)
    ORDER BY CASE WHEN p_channel='email' THEN c.email ELSE c.phone END,c.id LIMIT 10001;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN RAISE EXCEPTION 'CONTACT_NO_RECIPIENTS' USING ERRCODE='22023'; END IF;
  IF n>10000 THEN RAISE EXCEPTION 'CONTACT_CAMPAIGN_TOO_LARGE' USING ERRCODE='54000'; END IF;
  RETURN cid;
END; $$;
CREATE OR REPLACE FUNCTION public.cancel_depot_campaign(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.depot_assert_admin();
  UPDATE private.depot_campaigns SET status='cancelled' WHERE id=p_id AND status IN ('queued','blocked_provider');
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  UPDATE private.depot_deliveries SET status='cancelled',updated_at=now() WHERE campaign_id=p_id AND status='queued';
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.get_contact_depot(
  p_search text DEFAULT '',p_page integer DEFAULT 0,p_archived boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM private.depot_assert_admin();
  IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 100000 OR p_search IS NULL OR length(p_search)>120 OR p_archived IS NULL THEN
    RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  WITH filtered AS MATERIALIZED (
    SELECT c.* FROM private.depot_contacts c WHERE c.archived=p_archived AND (p_search='' OR
      strpos(lower(c.name),lower(p_search))>0 OR strpos(coalesce(c.email,''),lower(p_search))>0 OR
      strpos(coalesce(c.phone,c.raw_phone,''),p_search)>0)
  ), page AS (SELECT * FROM filtered ORDER BY created_at DESC,id OFFSET p_page*50 LIMIT 50)
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM filtered),'page',p_page,'page_size',50,
    'contacts',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'raw_phone',c.raw_phone,
      'manual',c.manual,'from_listing',c.from_listing,'archived',c.archived,'revision',c.revision,
      'created_at',c.created_at,'updated_at',c.updated_at,
      'listing_count',(SELECT count(*) FROM private.depot_sources s WHERE s.contact_id=c.id),
      'permissions',(SELECT jsonb_object_agg(p.channel,jsonb_build_object(
        'status',p.status,'evidence',p.evidence,'updated_at',p.updated_at)) FROM private.depot_permissions p WHERE p.contact_id=c.id)
    ) ORDER BY c.created_at DESC,c.id) FROM page c),'[]'::jsonb),
    'channels',(SELECT jsonb_agg(jsonb_build_object('channel',channel,'provider',provider,'enabled',enabled) ORDER BY channel) FROM private.depot_channels),
    'campaigns',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'name',c.name,'channel',c.channel,'subject',c.subject,'body',c.body,'scheduled_at',c.scheduled_at,
      'status',c.status,'created_at',c.created_at,'recipients',(SELECT count(*) FROM private.depot_deliveries d WHERE d.campaign_id=c.id),
      'sent',(SELECT count(*) FROM private.depot_deliveries d WHERE d.campaign_id=c.id AND d.status='sent'),
      'cancelled',(SELECT count(*) FROM private.depot_deliveries d WHERE d.campaign_id=c.id AND d.status='cancelled'),
      'failed',(SELECT count(*) FROM private.depot_deliveries d WHERE d.campaign_id=c.id AND d.status='failed'),
      'unknown',(SELECT count(*) FROM private.depot_deliveries d WHERE d.campaign_id=c.id AND d.status='unknown')
    ) ORDER BY c.created_at DESC,c.id) FROM (SELECT * FROM private.depot_campaigns ORDER BY created_at DESC,id LIMIT 20) c),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;

-- Worker boundary: no public/admin execute, no credentials or delivery transport in the browser.
CREATE OR REPLACE FUNCTION public.claim_depot_deliveries(p_limit integer DEFAULT 25) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  -- Never automatically replay an ambiguous delivery after a worker crash/time-out.
  UPDATE private.depot_deliveries SET status='unknown',updated_at=now() WHERE status='processing' AND lease_until<now();
  UPDATE private.depot_deliveries d SET status='cancelled',updated_at=now()
    FROM private.depot_contacts c,private.depot_permissions p,private.depot_campaigns campaign
    WHERE c.id=d.contact_id AND p.contact_id=c.id AND campaign.id=d.campaign_id AND p.channel=campaign.channel AND d.status='queued'
      AND (c.archived OR p.status<>'granted' OR campaign.status='cancelled' OR
        d.destination IS DISTINCT FROM CASE WHEN campaign.channel='email' THEN c.email ELSE c.phone END);
  WITH selected AS (
    SELECT d.id FROM private.depot_deliveries d JOIN private.depot_campaigns c ON c.id=d.campaign_id
      JOIN private.depot_channels ch ON ch.channel=c.channel
    WHERE d.status='queued' AND c.status='queued' AND ch.enabled AND c.scheduled_at<=now()
    ORDER BY c.scheduled_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE private.depot_deliveries d SET status='processing',lease=gen_random_uuid(),
      lease_until=now()+interval '5 minutes',updated_at=now() FROM selected s WHERE d.id=s.id RETURNING d.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'lease',d.lease,'destination',d.destination,'channel',c.channel,'provider',ch.provider,
    'subject',c.subject,'body',c.body,'unsubscribe_token',p.unsubscribe_token
  )),'[]'::jsonb) INTO result FROM claimed d JOIN private.depot_campaigns c ON c.id=d.campaign_id
    JOIN private.depot_channels ch ON ch.channel=c.channel
    JOIN private.depot_permissions p ON p.contact_id=d.contact_id AND p.channel=c.channel;
  RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.check_depot_delivery(p_id uuid,p_lease uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM private.depot_deliveries d JOIN private.depot_contacts c ON c.id=d.contact_id
    JOIN private.depot_campaigns m ON m.id=d.campaign_id JOIN private.depot_channels ch ON ch.channel=m.channel
    JOIN private.depot_permissions p ON p.contact_id=c.id AND p.channel=m.channel
    WHERE d.id=p_id AND d.lease=p_lease AND d.status='processing' AND d.lease_until>=now()
      AND NOT c.archived AND p.status='granted' AND ch.enabled AND m.status='queued'
      AND NOT EXISTS(SELECT 1 FROM private.depot_suppressions s WHERE s.channel=m.channel AND s.destination=d.destination)
      AND d.destination=CASE WHEN m.channel='email' THEN c.email ELSE c.phone END);
$$;
CREATE OR REPLACE FUNCTION public.finish_depot_delivery(p_id uuid,p_lease uuid,p_status text,p_provider_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('sent','failed','unknown','cancelled') OR length(coalesce(p_provider_id,''))>200 THEN
    RAISE EXCEPTION 'CONTACT_INVALID' USING ERRCODE='22023'; END IF;
  UPDATE private.depot_deliveries SET status=p_status,provider_id=p_provider_id,updated_at=now()
    WHERE id=p_id AND lease=p_lease AND status IN ('processing','unknown') RETURNING campaign_id INTO campaign;
  IF campaign IS NULL THEN RETURN false; END IF;
  UPDATE private.depot_campaigns c SET status='completed' WHERE c.id=campaign AND c.status='queued'
    AND NOT EXISTS(SELECT 1 FROM private.depot_deliveries d WHERE d.campaign_id=campaign AND d.status IN ('queued','processing','unknown'));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.save_depot_contact(uuid,integer,text,text,text),
  public.set_depot_permission(uuid,integer,text,boolean,text),public.archive_depot_contact(uuid,integer,boolean),
  public.queue_depot_campaign(text,text,text,text,timestamptz),public.cancel_depot_campaign(uuid),
  public.get_contact_depot(text,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_depot_contact(uuid,integer,text,text,text),
  public.set_depot_permission(uuid,integer,text,boolean,text),public.archive_depot_contact(uuid,integer,boolean),
  public.queue_depot_campaign(text,text,text,text,timestamptz),public.cancel_depot_campaign(uuid),
  public.get_contact_depot(text,integer,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.unsubscribe_depot_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_depot_contact(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_depot_deliveries(integer),public.check_depot_delivery(uuid,uuid),
  public.finish_depot_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_depot_deliveries(integer),public.check_depot_delivery(uuid,uuid),
  public.finish_depot_delivery(uuid,uuid,text,text) TO service_role;

-- Existing public advertiser contacts are captured once; unavailable legacy emails stay unknown.
DO $$
DECLARE l record;
BEGIN
  FOR l IN SELECT id,submitted_by,seller,phone FROM public.listings LOOP
    IF NOT EXISTS(SELECT 1 FROM private.depot_sources WHERE listing_id=l.id) THEN
      PERFORM private.capture_depot_listing(l.id,l.submitted_by,l.seller,l.phone);
    END IF;
  END LOOP;
END; $$;
-- Upgrade/backfill existing permission capabilities without exposing them to readers.
INSERT INTO private.depot_optout_links(token,channel,destination)
  SELECT p.unsubscribe_token,p.channel,CASE WHEN p.channel='email' THEN c.email ELSE c.phone END
  FROM private.depot_permissions p JOIN private.depot_contacts c ON c.id=p.contact_id
  WHERE CASE WHEN p.channel='email' THEN c.email IS NOT NULL ELSE c.phone IS NOT NULL END ON CONFLICT DO NOTHING;
NOTIFY pgrst,'reload schema';
COMMIT;