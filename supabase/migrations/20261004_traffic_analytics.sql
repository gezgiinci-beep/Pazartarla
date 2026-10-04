BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE IF NOT EXISTS private.traffic_config (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  collection_started_at timestamptz NOT NULL DEFAULT now(),
  last_purged_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.traffic_config(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS private.traffic_views (
  view_id uuid PRIMARY KEY, visitor_id uuid NOT NULL, session_id uuid NOT NULL,
  route text NOT NULL CHECK(route IN ('home','detail','favorites','add')),
  listing_id bigint,
  country text CHECK(country IS NULL OR country ~ '^[A-Z]{2}$'),
  region text CHECK(region IS NULL OR region ~ '^[A-Z0-9-]{1,12}$'),
  started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  active_seconds integer NOT NULL DEFAULT 0 CHECK(active_seconds BETWEEN 0 AND 43200),
  CHECK((route='detail' AND listing_id IS NOT NULL) OR (route<>'detail' AND listing_id IS NULL)),
  CHECK(country IS NOT NULL OR region IS NULL)
);
CREATE INDEX IF NOT EXISTS traffic_views_started_idx ON private.traffic_views(started_at);
CREATE INDEX IF NOT EXISTS traffic_views_visitor_started_idx ON private.traffic_views(visitor_id,started_at);
ALTER TABLE private.traffic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.traffic_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.traffic_config,private.traffic_views FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.traffic_collector_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM private.traffic_views WHERE started_at<now()-interval '90 days';
  RETURN jsonb_build_object('ready',EXISTS(SELECT 1 FROM private.traffic_config WHERE id));
END;
$$;
REVOKE ALL ON FUNCTION public.traffic_collector_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.traffic_collector_status() TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_traffic_view(
  p_view_id uuid,p_visitor_id uuid,p_session_id uuid,p_route text,p_listing_id bigint,
  p_active_seconds integer,p_country text,p_region text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing private.traffic_views%ROWTYPE; purged boolean;
BEGIN
  IF p_view_id IS NULL OR p_visitor_id IS NULL OR p_session_id IS NULL
    OR p_route IS NULL OR p_route NOT IN ('home','detail','favorites','add')
    OR p_active_seconds IS NULL OR p_active_seconds NOT BETWEEN 0 AND 43200
    OR (p_country IS NOT NULL AND p_country !~ '^[A-Z]{2}$')
    OR (p_region IS NOT NULL AND (p_country IS NULL OR p_region !~ '^[A-Z0-9-]{1,12}$'))
    OR (p_route='detail' AND (p_listing_id IS NULL OR p_listing_id<=0))
    OR (p_route<>'detail' AND p_listing_id IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_traffic_view' USING ERRCODE='22023';
  END IF;
  -- One cleanup per day; only new analytics records, never listings or media.
  UPDATE private.traffic_config SET last_purged_at=now()
    WHERE id AND last_purged_at<now()-interval '1 day' RETURNING true INTO purged;
  IF purged THEN DELETE FROM private.traffic_views WHERE started_at<now()-interval '90 days'; END IF;
  -- Serialize writes per browser to make the new-view rate bound concurrency-safe.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_visitor_id::text,713));
  SELECT * INTO existing FROM private.traffic_views WHERE view_id=p_view_id;
  IF FOUND THEN
    IF existing.visitor_id<>p_visitor_id OR existing.session_id<>p_session_id
      OR existing.route<>p_route OR existing.listing_id IS DISTINCT FROM p_listing_id THEN
      RAISE EXCEPTION 'traffic_identity_mismatch' USING ERRCODE='22023';
    END IF;
    UPDATE private.traffic_views SET
      active_seconds=greatest(active_seconds,least(p_active_seconds,
        greatest(0,floor(extract(epoch FROM now()-started_at)))::integer)),
      updated_at=now() WHERE view_id=p_view_id;
    RETURN true;
  END IF;
  IF (SELECT count(*) FROM private.traffic_views WHERE visitor_id=p_visitor_id
    AND started_at>now()-interval '1 hour')>=240 THEN
    RAISE EXCEPTION 'traffic_rate_limit' USING ERRCODE='54000';
  END IF;
  IF p_route='detail' AND NOT EXISTS(SELECT 1 FROM public.listings
    WHERE id=p_listing_id AND status='approved' AND created_at+interval '8 months'>now()) THEN
    RAISE EXCEPTION 'traffic_listing_not_public' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.traffic_views(view_id,visitor_id,session_id,route,listing_id,country,region)
    VALUES(p_view_id,p_visitor_id,p_session_id,p_route,p_listing_id,p_country,p_region);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.record_traffic_view(uuid,uuid,uuid,text,bigint,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_traffic_view(uuid,uuid,uuid,text,bigint,integer,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_traffic_report(p_days integer DEFAULT 7) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; start_at timestamptz;
BEGIN
  IF NOT public.is_listing_admin() THEN RAISE EXCEPTION 'traffic_admin_required' USING ERRCODE='42501'; END IF;
  IF p_days IS NULL OR p_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'invalid_traffic_period' USING ERRCODE='22023'; END IF;
  start_at:=((now() AT TIME ZONE 'Europe/Istanbul')::date-(p_days-1))::timestamp AT TIME ZONE 'Europe/Istanbul';
  WITH scoped AS MATERIALIZED (
    SELECT visitor_id,session_id,route,listing_id,country,region,started_at,active_seconds
      FROM private.traffic_views WHERE started_at>=start_at AND started_at<=now()
  ), browsers AS (
    SELECT visitor_id,count(DISTINCT session_id) sessions FROM scoped GROUP BY visitor_id
  ), totals AS (
    SELECT count(*) views,count(DISTINCT visitor_id) browsers,count(DISTINCT session_id) sessions,
      count(*) FILTER(WHERE route='detail') detail_views,coalesce(sum(active_seconds),0) seconds FROM scoped
  ), regions AS (
    SELECT country,region,count(*) views,count(DISTINCT visitor_id) browsers,
      count(DISTINCT session_id) sessions,coalesce(sum(active_seconds),0) seconds
      FROM scoped GROUP BY country,region
  ), ranked_regions AS (
    SELECT * FROM regions ORDER BY views DESC,country NULLS LAST,region NULLS LAST LIMIT 50
  ), days AS (
    SELECT generate_series(0,p_days-1) offset_day
  ), daily AS (
    SELECT (started_at AT TIME ZONE 'Europe/Istanbul')::date AS day,count(*) views,
      count(DISTINCT session_id) sessions,sum(active_seconds) seconds FROM scoped GROUP BY 1
  ), listing_counts AS (
    SELECT listing_id,count(*) views,sum(active_seconds) seconds FROM scoped WHERE route='detail' GROUP BY listing_id
  ), ranked_listings AS (
    SELECT c.*,coalesce(l.title,'Silinmiş ilan') title FROM listing_counts c
      LEFT JOIN public.listings l ON l.id=c.listing_id ORDER BY c.views DESC,c.listing_id LIMIT 50
  )
  SELECT jsonb_build_object(
    'period_days',p_days,'collection_started_at',(SELECT collection_started_at FROM private.traffic_config WHERE id),
    'window_start',start_at,'generated_at',now(),
    'summary',jsonb_build_object(
      'total_views',t.views,'unique_browsers',t.browsers,'total_sessions',t.sessions,'detail_views',t.detail_views,
      'total_active_seconds',t.seconds,'avg_session_seconds',coalesce(t.seconds::numeric/nullif(t.sessions,0),0),
      'visits_per_browser',coalesce(t.sessions::numeric/nullif(t.browsers,0),0),
      'returning_rate',coalesce((SELECT count(*) FROM browsers WHERE sessions>1)*100.0/nullif(t.browsers,0),0)),
    'region_count',(SELECT count(*) FROM regions),
    'regions',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'country',r.country,'region',r.region,'views',r.views,'browsers',r.browsers,'sessions',r.sessions,
      'active_seconds',r.seconds,'avg_session_seconds',r.seconds::numeric/r.sessions,
      'visits_per_browser',r.sessions::numeric/r.browsers,'share_percent',r.views*100.0/nullif(t.views,0)
    ) ORDER BY r.views DESC,r.country NULLS LAST,r.region NULLS LAST) FROM ranked_regions r),'[]'::jsonb),
    'daily',(SELECT jsonb_agg(jsonb_build_object(
      'day',to_char((start_at AT TIME ZONE 'Europe/Istanbul')::date+d.offset_day,'YYYY-MM-DD'),
      'views',coalesce(a.views,0),'sessions',coalesce(a.sessions,0),'active_seconds',coalesce(a.seconds,0)
    ) ORDER BY d.offset_day) FROM days d LEFT JOIN daily a ON a.day=(start_at AT TIME ZONE 'Europe/Istanbul')::date+d.offset_day),
    'listing_count',(SELECT count(*) FROM listing_counts),
    'listings',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'listing_id',r.listing_id::text,'title',r.title,'views',r.views,'active_seconds',r.seconds,
      'share_percent',r.views*100.0/nullif(t.detail_views,0)
    ) ORDER BY r.views DESC,r.listing_id) FROM ranked_listings r),'[]'::jsonb)
  ) INTO result FROM totals t;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_traffic_report(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_traffic_report(integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;