-- INACTIVE PROPOSAL — not an applied migration.
-- Gmail OAuth uses the Vercel secret flow; the user selected no database change.
-- Do not copy this file into migrations/ or apply it without a separate review
-- and explicit database approval.

begin;

create table if not exists public.gmail_inbox_connection (
  singleton boolean primary key default true check (singleton),
  mailbox_email text not null check (char_length(mailbox_email) between 3 and 320),
  encrypted_refresh_token text not null check (char_length(encrypted_refresh_token) between 24 and 8192),
  token_iv text not null check (char_length(token_iv) between 12 and 128),
  connected_by uuid not null default auth.uid() references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_inbox_connection enable row level security;
revoke all on table public.gmail_inbox_connection from public, anon, authenticated;
grant select, insert, update on table public.gmail_inbox_connection to authenticated;

drop policy if exists gmail_inbox_admin_only on public.gmail_inbox_connection;
create policy gmail_inbox_admin_only
  on public.gmail_inbox_connection
  as permissive
  for all
  to authenticated
  using ((select public.is_listing_admin()))
  with check ((select public.is_listing_admin()));

notify pgrst, 'reload schema';

commit;
