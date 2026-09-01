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
  select coalesce(access_token_secret_id, refresh_token_secret_id)
    into secret_id
  from public.site_web_connections
  where user_id = p_user_id and provider = p_provider and status = 'connected';

  if secret_id is null then
    return null;
  end if;

  select decrypted_secret into payload
  from vault.decrypted_secrets
  where id = secret_id;

  if payload is null then
    return null;
  end if;

  return payload::jsonb;
end;
$$;

revoke all on function public.get_site_web_google_tokens(uuid, text) from public, anon, authenticated;
grant execute on function public.get_site_web_google_tokens(uuid, text) to service_role;
