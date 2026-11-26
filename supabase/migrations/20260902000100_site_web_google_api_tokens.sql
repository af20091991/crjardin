create or replace function public.store_site_web_google_tokens(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_external_account_id text default null,
  p_external_account_name text default null,
  p_scopes text[] default '{}'
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
    coalesce(p_scopes, '{}'), secret_id, secret_id, p_expires_at, null, null
  )
  on conflict (user_id, provider) do update set
    status = 'connected',
    external_account_id = coalesce(excluded.external_account_id, public.site_web_connections.external_account_id),
    external_account_name = coalesce(excluded.external_account_name, public.site_web_connections.external_account_name),
    scopes = excluded.scopes,
    access_token_secret_id = excluded.access_token_secret_id,
    refresh_token_secret_id = excluded.refresh_token_secret_id,
    token_expires_at = excluded.token_expires_at,
    last_error = null,
    updated_at = now();

  return secret_id;
end;
$$;

revoke all on function public.store_site_web_google_tokens(uuid,text,text,text,timestamptz,text,text,text[]) from public, anon, authenticated;
grant execute on function public.store_site_web_google_tokens(uuid,text,text,text,timestamptz,text,text,text[]) to service_role;

create or replace function public.get_site_web_google_tokens(
  p_user_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, vault
as $$
declare
  secret_id uuid;
  payload text;
begin
  select access_token_secret_id
    into secret_id
  from public.site_web_connections
  where user_id = p_user_id and provider = p_provider and status = 'connected';

  if secret_id is null then return null; end if;

  select decrypted_secret into payload
  from vault.decrypted_secrets
  where id = secret_id;

  if payload is null then return null; end if;
  return payload::jsonb;
end;
$$;

revoke all on function public.get_site_web_google_tokens(uuid,text) from public, anon, authenticated;
grant execute on function public.get_site_web_google_tokens(uuid,text) to service_role;
