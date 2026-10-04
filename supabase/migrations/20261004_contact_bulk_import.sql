BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE INDEX IF NOT EXISTS depot_contact_email_import_idx ON private.depot_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS depot_contact_phone_import_idx ON private.depot_contacts(phone) WHERE phone IS NOT NULL;
CREATE TABLE IF NOT EXISTS private.depot_import_receipts (
  request_id text PRIMARY KEY,actor uuid NOT NULL,input_hash text NOT NULL,
  result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.depot_import_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.depot_import_receipts FROM PUBLIC,anon,authenticated;

-- Serialize automatic listing capture with contact/import mutations.
-- Separate trigger avoids overwriting the original listing capture or submission guards.
CREATE OR REPLACE FUNCTION private.depot_import_listing_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(713,714);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.depot_import_listing_lock() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pazartarla_depot_import_lock ON public.listings;
CREATE TRIGGER pazartarla_depot_import_lock BEFORE INSERT OR UPDATE OF seller,phone,submitted_by ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.depot_import_listing_lock();

CREATE OR REPLACE FUNCTION private.depot_process_import(p_rows jsonb,p_save boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;n text;e text;p text;raw text;rid integer;state text;reason text;
  emails text[]:='{}';phones text[]:='{}';result jsonb:='[]';cid uuid;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'CONTACT_IMPORT_SIZE' USING ERRCODE='22023'; END IF;
  IF length(p_rows::text)>150000 THEN RAISE EXCEPTION 'CONTACT_IMPORT_SIZE' USING ERRCODE='22023'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF jsonb_typeof(r)<>'object' OR coalesce(r->>'row','') !~ '^[1-9][0-9]{0,3}$' OR
      jsonb_typeof(r->'row')<>'number' THEN RAISE EXCEPTION 'CONTACT_IMPORT_INVALID' USING ERRCODE='22023'; END IF;
    rid:=(r->>'row')::integer;n:=trim(coalesce(r->>'name',''));
    e:=nullif(lower(trim(coalesce(r->>'email',''))),'');
    raw:=trim(coalesce(r->>'phone',''));p:=private.depot_phone(raw);
    state:='ready';reason:='';
    IF jsonb_typeof(r->'name') IS DISTINCT FROM 'string' OR
      jsonb_typeof(r->'email') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'phone') IS DISTINCT FROM 'string' THEN
      state:='invalid';reason:='Alanlar metin biçiminde olmalı.';
    ELSIF length(n) NOT BETWEEN 1 AND 120 THEN state:='invalid';reason:='Ad/soyad boş veya çok uzun.';
    ELSIF e IS NOT NULL AND (length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
      state:='invalid';reason:='Geçersiz e-posta.';
    ELSIF raw<>'' AND (p IS NULL OR length(raw)>40) THEN state:='invalid';reason:='Geçersiz telefon.';
    ELSIF e IS NULL AND p IS NULL THEN state:='invalid';reason:='E-posta ve telefon birlikte boş.';
    ELSIF (e IS NOT NULL AND e=ANY(emails)) OR (p IS NOT NULL AND p=ANY(phones)) THEN
      state:='duplicate';reason:='Dosyada aynı e-posta veya telefon daha önce var.';
    ELSIF EXISTS(SELECT 1 FROM private.depot_contacts c WHERE (e IS NOT NULL AND c.email=e) OR (p IS NOT NULL AND c.phone=p)) THEN
      state:='duplicate';reason:='Depoda aynı e-posta veya telefon var (arşiv dahil). Mevcut kayıt değiştirilmedi.';
    END IF;
    IF state='ready' THEN
      IF e IS NOT NULL THEN emails:=array_append(emails,e); END IF;
      IF p IS NOT NULL THEN phones:=array_append(phones,p); END IF;
      IF p_save THEN
        INSERT INTO private.depot_contacts(identity_key,name,email,phone,raw_phone,manual)
          VALUES(jsonb_build_array(e,coalesce(p,''))::text,n,e,p,nullif(raw,''),true)
          ON CONFLICT DO NOTHING RETURNING id INTO cid;
        IF cid IS NULL THEN state:='duplicate';reason:='Kayıt başka bir oturumda eklendi. Mevcut kişi değiştirilmedi.';
        ELSE PERFORM private.depot_initialize_permissions(cid);state:='imported'; END IF;
      END IF;
    END IF;
    result:=result||jsonb_build_array(jsonb_build_object('row',rid,'status',state,'reason',reason));
  END LOOP;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION private.depot_process_import(jsonb,boolean) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.preview_depot_import(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.depot_assert_admin();
  RETURN private.depot_process_import(p_rows,false);
END; $$;
CREATE OR REPLACE FUNCTION public.import_depot_contacts(p_rows jsonb,p_request_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old private.depot_import_receipts%ROWTYPE;h text;report jsonb;
BEGIN
  PERFORM private.depot_assert_admin();
  IF p_request_id IS NULL OR p_request_id !~ '^[0-9a-f-]{36}:[0-9]{1,4}$' THEN
    RAISE EXCEPTION 'CONTACT_IMPORT_INVALID' USING ERRCODE='22023'; END IF;
  h:=encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
  SELECT * INTO old FROM private.depot_import_receipts WHERE request_id=p_request_id;
  IF FOUND THEN
    IF old.actor IS DISTINCT FROM auth.uid() OR old.input_hash IS DISTINCT FROM h THEN
      RAISE EXCEPTION 'CONTACT_IMPORT_CHANGED' USING ERRCODE='40001'; END IF;
    RETURN old.result;
  END IF;
  report:=private.depot_process_import(p_rows,true);
  INSERT INTO private.depot_import_receipts(request_id,actor,input_hash,result) VALUES(p_request_id,auth.uid(),h,report);
  RETURN report;
END; $$;
REVOKE ALL ON FUNCTION public.preview_depot_import(jsonb),public.import_depot_contacts(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_depot_import(jsonb),public.import_depot_contacts(jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;