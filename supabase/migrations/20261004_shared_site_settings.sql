-- Requires the existing is_listing_admin() function from the admin migration.
-- Only this new settings table is changed; listings and existing admin accounts are untouched.
begin;

create or replace function public.valid_site_categories(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  entry record;
  sub jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_each(value)) not between 1 and 100 then return false; end if;
  for entry in select key, val from jsonb_each(value) as items(key, val) loop
    if length(entry.key) not between 1 and 100 or entry.key <> btrim(entry.key)
       or entry.key in ('__proto__', 'constructor', 'prototype')
       or jsonb_typeof(entry.val) <> 'array' then return false; end if;
    if jsonb_array_length(entry.val) not between 1 and 200 then return false; end if;
    for sub in select * from jsonb_array_elements(entry.val) loop
      if jsonb_typeof(sub) <> 'string' or length(sub #>> '{}') not between 1 and 100
         or (sub #>> '{}') <> btrim(sub #>> '{}') then return false; end if;
    end loop;
    if (select count(distinct element) from jsonb_array_elements(entry.val) as elements(element))
       <> jsonb_array_length(entry.val) then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.valid_site_categories(jsonb) from public;
grant execute on function public.valid_site_categories(jsonb) to anon, authenticated;

create table if not exists public.site_settings (
  id text primary key check (id = 'public'),
  announcement text not null check (length(announcement) <= 1000),
  categories jsonb not null check (public.valid_site_categories(categories)),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

insert into public.site_settings(id, announcement, categories)
values ('public',
  '🌾 Türkiye genelinden tarım aletleri, veterinerler ve taze mahsul ilanları PazarTarla''da!',
  '{
    "Mahsuller": ["Kiraz", "Ceviz", "Zeytin & Zeytinyağı", "Buğday", "Bakliyat", "Meyve & Sebze"],
    "Canlı Hayvanlar": ["Büyükbaş", "Küçükbaş", "Kanatlı"],
    "Hayvan Yemleri ve Ekipmanları": ["Yem Çeşitleri", "Suluk / Yemlik"],
    "Arıcılık": ["Bal", "Polen", "Arı Ekmeği", "Arı Sütü", "Kovan ve Ekipmanları"],
    "Traktör": ["İkinci El Traktör", "Sıfır Traktör", "Ekipmanlar"],
    "Biçerdöver": ["Biçerdöver"],
    "Tarım Ekipmanları": ["Römork", "İlaçlama Makinesi", "Çapa Makinası", "Pulluk", "Kepçe & Yükleyici"],
    "Tarım İşçileri": ["Hasat Ekibi", "Budama Ekibi"],
    "Uzmanlar": ["Veterinerler", "Ziraatçiler"],
    "Endüstriyel Çadırlar": ["Çadır Örtüsü", "Depo Çadırı"],
    "Geçici Konutlar": ["Konteyner", "Çadır", "Prefabrik"]
  }'::jsonb)
on conflict (id) do nothing;

create or replace function public.advance_site_settings_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.advance_site_settings_revision() from public, anon, authenticated;
drop trigger if exists site_settings_revision on public.site_settings;
create trigger site_settings_revision before update on public.site_settings
for each row execute function public.advance_site_settings_revision();

alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update(announcement, categories) on public.site_settings to authenticated;

drop policy if exists site_settings_public_read on public.site_settings;
drop policy if exists site_settings_admin_update on public.site_settings;
drop policy if exists site_settings_update_guard on public.site_settings;
create policy site_settings_public_read on public.site_settings
for select to anon, authenticated using (true);
create policy site_settings_admin_update on public.site_settings
for update to authenticated using ((select public.is_listing_admin()))
with check ((select public.is_listing_admin()));
create policy site_settings_update_guard on public.site_settings as restrictive
for update to public using ((select public.is_listing_admin()))
with check ((select public.is_listing_admin()));

notify pgrst, 'reload schema';
commit;