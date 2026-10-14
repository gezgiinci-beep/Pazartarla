// Disposable synthetic database only. No environment-derived connection strings.
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';

const exec = promisify(execFile);
export const actors = Object.freeze({
  owner: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  admin: '00000000-0000-4000-8000-000000000003',
  anonymous: '',
});

export async function createTestDatabase() {
  const dir = await mkdtemp(join(tmpdir(), 'listing-editor-browser-'));
  const env = {PATH: process.env.PATH, HOME: dir, LANG: 'C'};
  const config = {host: dir, port: 63379, user: 'safety_test', database: 'postgres', ssl: false, password: ''};
  let running = false;
  let setup;
  const clients = new Set();
  async function close() {
    await Promise.all([...clients].map(c => c.end().catch(() => {})));
    if (running) {
      try {
        await exec('pg_ctl', ['-D', join(dir, 'data'), '-m', 'fast', '-w', 'stop'], {env});
      } catch (error) {
        // The workflow may terminate PostgreSQL before Node's signal handler.
        try {
          await exec('pg_ctl', ['-D', join(dir, 'data'), 'status'], {env});
          throw error;
        } catch (status) {
          if (status.code !== 3) throw status;
        }
      }
      running = false;
    }
    await rm(dir, {recursive: true, force: true});
  }
  async function connect() {
    const c = new pg.Client(config);
    await c.connect();
    clients.add(c);
    return c;
  }
  try {
    await exec('initdb', ['-D', join(dir, 'data'), '-U', 'safety_test', '-A', 'trust', '--no-locale', '--encoding=UTF8'], {env});
    await exec('pg_ctl', ['-D', join(dir, 'data'), '-l', join(dir, 'log'), '-o',
      `-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63379`, '-w', 'start'], {env});
    running = true;
    setup = await connect();
    await setup.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE FUNCTION public.is_listing_admin() RETURNS bool LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.uid()='${actors.admin}',false) $$;
      CREATE FUNCTION public.is_verified_listing_submitter() RETURNS bool LANGUAGE sql STABLE AS $$ SELECT auth.uid() IS NOT NULL $$;
      CREATE TABLE public.site_settings(id text PRIMARY KEY,categories jsonb);
      INSERT INTO public.site_settings VALUES('public','{"Mahsuller":["Ceviz","Buğday"],"Makineler":["Traktör"]}');
      CREATE TABLE public.listings(id serial PRIMARY KEY,submitted_by uuid,title text,price numeric,category text,"subCategory" text,
        location text,description text,seller text,phone text,status text,image text,seotags text,mode text,created_at timestamptz,expires_at timestamptz);
      INSERT INTO public.listings(submitted_by,title,price,category,"subCategory",location,description,seller,phone,status,image,seotags,mode,created_at,expires_at)
      VALUES('${actors.owner}','TEST — Sentetik ceviz ilanı',150,'Mahsuller','Ceviz','TEST konumu','Sentetik açıklama','TEST satıcısı','+12025550100',
        'approved','https://example.invalid/synthetic-photo','KEEP-GALLERY-AND-FEATURED','Satılık',now()-interval '1 month',now()+interval '7 months');
      ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      GRANT SELECT,UPDATE,DELETE ON public.listings TO authenticated;
      GRANT SELECT ON public.listings TO anon;
      CREATE POLICY admin_only_update ON public.listings FOR UPDATE TO authenticated USING(public.is_listing_admin()) WITH CHECK(public.is_listing_admin());
      CREATE POLICY visible ON public.listings FOR SELECT TO authenticated USING(status='approved' OR submitted_by=auth.uid() OR public.is_listing_admin());
      CREATE POLICY public_visible ON public.listings FOR SELECT TO anon USING(status='approved' AND expires_at>clock_timestamp());`);
    const baseline = (await setup.query('SELECT to_jsonb(l) row FROM public.listings l WHERE id=1')).rows[0].row;
    const categories = (await setup.query("SELECT categories FROM public.site_settings WHERE id='public'")).rows[0].categories;
    await setup.query(await readFile(new URL('../supabase/reviewed_changes/20261004_owner_listing_edit.sql', import.meta.url), 'utf8'));
    await setup.end();
    clients.delete(setup);
    async function as(actor, fn) {
      if (!Object.hasOwn(actors, actor)) throw Object.assign(new Error('Unknown test actor'), {code:'22023'});
      const c = await connect();
      try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('test.uid',$1,true)", [actors[actor]]);
        await c.query(actor === 'anonymous' ? 'SET LOCAL ROLE anon' : 'SET LOCAL ROLE authenticated');
        const result = await fn(c);
        await c.query('COMMIT');
        return result;
      } catch (error) {
        await c.query('ROLLBACK');
        throw error;
      } finally {
        await c.end();
        clients.delete(c);
      }
    }
    return {as, baseline, categories, close};
  } catch (error) {
    await close();
    throw error;
  }
}
