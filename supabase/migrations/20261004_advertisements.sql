-- Additive setup for advertisement records and a dedicated public media bucket.
-- Requires existing public.is_listing_admin(); does not modify listings or users.
begin;
create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120 and title=btrim(title)),
  target_url text check (target_url is null or (length(target_url)<=2048 and target_url ~ '^https?://[^[:space:]]+$')),
  media_path text not null unique check (
    media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$'
    and split_part(media_path,'/',1)=id::text
  ),
  media_type text not null check (media_type in ('image','video')),
  is_active boolean not null default false,
  revision integer not null default 1 check (revision>0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((media_type='image' and media_path ~ '\.(jpg|png|webp)$')
    or (media_type='video' and media_path ~ '\.(mp4|webm)$'))
);
create or replace function public.advertisements_audit() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.created_by:=auth.uid(); new.created_at:=now(); new.revision:=1;
  else
    new.created_by:=old.created_by; new.created_at:=old.created_at;
    new.revision:=old.revision+1;
  end if;
  new.updated_at:=now();
  return new;
end; $$;
revoke all on function public.advertisements_audit() from public,anon,authenticated;
drop trigger if exists advertisements_audit on public.advertisements;
create trigger advertisements_audit before insert or update on public.advertisements
for each row execute function public.advertisements_audit();
alter table public.advertisements enable row level security;
revoke all on public.advertisements from public,anon,authenticated;
grant select on public.advertisements to anon,authenticated;
grant insert(id,title,target_url,media_path,media_type,is_active) on public.advertisements to authenticated;
grant update(title,target_url,is_active) on public.advertisements to authenticated;
grant delete on public.advertisements to authenticated;
drop policy if exists advertisements_read on public.advertisements;
create policy advertisements_read on public.advertisements for select to anon,authenticated
using (is_active or (select public.is_listing_admin()));
drop policy if exists advertisements_admin on public.advertisements;
create policy advertisements_admin on public.advertisements for all to authenticated
using ((select public.is_listing_admin())) with check ((select public.is_listing_admin()));
drop policy if exists advertisements_insert_guard on public.advertisements;
create policy advertisements_insert_guard on public.advertisements as restrictive for insert to public
with check ((select public.is_listing_admin()));
drop policy if exists advertisements_update_guard on public.advertisements;
create policy advertisements_update_guard on public.advertisements as restrictive for update to public
using ((select public.is_listing_admin())) with check ((select public.is_listing_admin()));
drop policy if exists advertisements_delete_guard on public.advertisements;
create policy advertisements_delete_guard on public.advertisements as restrictive for delete to public
using ((select public.is_listing_admin()));
-- Bucket configuration is metadata only; file bytes must go through the Storage API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('site-advertisements','site-advertisements',true,52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do nothing;
drop policy if exists ad_media_admin on storage.objects;
create policy ad_media_admin on storage.objects for all to authenticated
using (bucket_id='site-advertisements' and (select public.is_listing_admin()))
with check (bucket_id='site-advertisements' and (select public.is_listing_admin())
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$');
-- Protect this bucket from unrelated permissive policies, leaving other buckets unchanged.
drop policy if exists ad_media_insert_guard on storage.objects;
create policy ad_media_insert_guard on storage.objects as restrictive for insert to public
with check (bucket_id<>'site-advertisements' or (select public.is_listing_admin()));
drop policy if exists ad_media_update_guard on storage.objects;
create policy ad_media_update_guard on storage.objects as restrictive for update to public
using (bucket_id<>'site-advertisements' or (select public.is_listing_admin()))
with check (bucket_id<>'site-advertisements' or (select public.is_listing_admin()));
drop policy if exists ad_media_delete_guard on storage.objects;
create policy ad_media_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id<>'site-advertisements' or (select public.is_listing_admin()));
notify pgrst,'reload schema';
commit;