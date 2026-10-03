-- Protect listing changes with Supabase Auth and row-level security.
-- This migration deliberately does not seed an administrator email; see ADMIN_SETUP.md.

begin;

create schema if not exists private;

create table if not exists private.listing_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint listing_admins_email_normalized check (email = lower(trim(email)))
);

alter table private.listing_admins enable row level security;
revoke all on table private.listing_admins from public, anon, authenticated;

create or replace function public.is_listing_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.listing_admins as admin
    where admin.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

revoke all on function public.is_listing_admin() from public;
grant execute on function public.is_listing_admin() to anon, authenticated;

alter table public.listings enable row level security;

grant select, insert on table public.listings to anon, authenticated;
revoke update, delete on table public.listings from public, anon;
grant update, delete on table public.listings to authenticated;

drop policy if exists pazartarla_public_select_approved on public.listings;
drop policy if exists pazartarla_admin_select_all on public.listings;
drop policy if exists pazartarla_select_guard on public.listings;
drop policy if exists pazartarla_public_insert_approved on public.listings;
drop policy if exists pazartarla_insert_guard on public.listings;
drop policy if exists pazartarla_admin_update on public.listings;
drop policy if exists pazartarla_update_guard on public.listings;
drop policy if exists pazartarla_admin_delete on public.listings;
drop policy if exists pazartarla_delete_guard on public.listings;

create policy pazartarla_public_select_approved
  on public.listings as permissive for select to anon, authenticated
  using (status = 'approved');

create policy pazartarla_admin_select_all
  on public.listings as permissive for select to authenticated
  using ((select public.is_listing_admin()));

create policy pazartarla_select_guard
  on public.listings as restrictive for select to anon, authenticated
  using (status = 'approved' or (select public.is_listing_admin()));

-- The current public listing form inserts approved listings. Preserve that behavior.
create policy pazartarla_public_insert_approved
  on public.listings as permissive for insert to anon, authenticated
  with check (status = 'approved' or (select public.is_listing_admin()));

create policy pazartarla_insert_guard
  on public.listings as restrictive for insert to anon, authenticated
  with check (status = 'approved' or (select public.is_listing_admin()));

create policy pazartarla_admin_update
  on public.listings as permissive for update to authenticated
  using ((select public.is_listing_admin()))
  with check ((select public.is_listing_admin()));

create policy pazartarla_update_guard
  on public.listings as restrictive for update to public
  using ((select public.is_listing_admin()))
  with check ((select public.is_listing_admin()));

create policy pazartarla_admin_delete
  on public.listings as permissive for delete to authenticated
  using ((select public.is_listing_admin()));

create policy pazartarla_delete_guard
  on public.listings as restrictive for delete to public
  using ((select public.is_listing_admin()));

notify pgrst, 'reload schema';

commit;
