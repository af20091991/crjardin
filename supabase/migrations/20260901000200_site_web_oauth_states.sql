create table if not exists public.site_web_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics_4', 'google_business_profile')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists site_web_oauth_states_expires_at_idx
  on public.site_web_oauth_states (expires_at);

alter table public.site_web_oauth_states enable row level security;

create or replace function public.consume_site_web_oauth_state(
  p_state_hash text,
  p_user_id uuid,
  p_provider text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  consumed boolean;
begin
  delete from public.site_web_oauth_states
  where state_hash = p_state_hash
    and user_id = p_user_id
    and provider = p_provider
    and expires_at > now();
  get diagnostics consumed = row_count;
  return consumed;
end;
$$;

revoke all on function public.consume_site_web_oauth_state(text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_site_web_oauth_state(text, uuid, text) to service_role;

create or replace function public.store_site_web_google_tokens(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_external_account_id text default null,
  p_external_account_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, vault
as $$
declare
  secret_id uuid;
begin
  if p_provider not in ('google_search_console', 'google_analytics_4', 'google_business_profile') then
    raise exception 'unsupported_provider';
  end if;

  secret_id := vault.create_secret(
    jsonb_build_object(
      'access_token', p_access_token,
      'refresh_token', p_refresh_token,
      'expires_at', p_expires_at
    )::text,
    'site_web_google_' || p_user_id::text || '_' || p_provider,
    'Encrypted Google OAuth tokens for Pilot Pro Site Web'
  );

  insert into public.site_web_connections (
    user_id, provider, status, external_account_id, external_account_name,
    scopes, access_token_secret_id, refresh_token_secret_id, token_expires_at,
    last_sync_status, last_error
  ) values (
    p_user_id, p_provider, 'connected', p_external_account_id, p_external_account_name,
    case when p_provider = 'google_search_console' then array['https://www.googleapis.com/auth/webmasters.readonly']::text[] else '{}'::text[] end,
    secret_id, secret_id, p_expires_at, null, null
  )
  on conflict (user_id, provider) do update set
    status = 'connected',
    external_account_id = excluded.external_account_id,
    external_account_name = excluded.external_account_name,
    scopes = excluded.scopes,
    access_token_secret_id = excluded.access_token_secret_id,
    refresh_token_secret_id = excluded.refresh_token_secret_id,
    token_expires_at = excluded.token_expires_at,
    last_error = null,
    updated_at = now();

  return secret_id;
end;
$$;

revoke all on function public.store_site_web_google_tokens(uuid, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.store_site_web_google_tokens(uuid, text, text, text, timestamptz, text, text) to service_role;
