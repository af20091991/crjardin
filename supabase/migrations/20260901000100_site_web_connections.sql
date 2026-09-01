create table if not exists public.site_web_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics_4', 'google_business_profile')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connecting', 'connected', 'error')),
  external_account_id text,
  external_account_name text,
  scopes text[] not null default '{}',
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status is null or last_sync_status in ('success', 'error')),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists site_web_connections_user_id_idx
  on public.site_web_connections (user_id);

alter table public.site_web_connections enable row level security;

create policy "site_web_connections_select_own"
  on public.site_web_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "site_web_connections_insert_own"
  on public.site_web_connections
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "site_web_connections_update_own"
  on public.site_web_connections
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "site_web_connections_delete_own"
  on public.site_web_connections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_site_web_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_web_connections_updated_at on public.site_web_connections;
create trigger site_web_connections_updated_at
before update on public.site_web_connections
for each row execute function public.set_site_web_connections_updated_at();
