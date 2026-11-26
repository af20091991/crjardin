create table if not exists public.site_web_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics_4', 'google_business_profile')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  external_account_id text,
  external_account_name text,
  scopes text[] not null default '{}',
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists idx_site_web_connections_user_id
  on public.site_web_connections(user_id);

create table if not exists public.site_web_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics_4', 'google_business_profile')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_web_oauth_states_expires_at
  on public.site_web_oauth_states(expires_at);

alter table public.site_web_connections enable row level security;
alter table public.site_web_oauth_states enable row level security;

revoke all on table public.site_web_connections from anon, authenticated;
revoke all on table public.site_web_oauth_states from anon, authenticated;
grant all on table public.site_web_connections to service_role;
grant all on table public.site_web_oauth_states to service_role;

create or replace function public.consume_site_web_oauth_state(
  p_state_hash text,
  p_user_id uuid,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.site_web_oauth_states
  where state_hash = p_state_hash
    and user_id = p_user_id
    and provider = p_provider;
end;
$$;

revoke all on function public.consume_site_web_oauth_state(text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_site_web_oauth_state(text, uuid, text) to service_role;
