-- Chantier 4 — le client dépose un document dans son espace Premium.
-- L'email de notification est géré côté TS (finalizeSharedPremiumDocumentUpload
-- dans share.functions.ts, template 'client-activity') — voir la migration
-- 20260920120000 pour le pourquoi (public.enqueue_email n'existe pas).

create or replace function public.add_client_premium_document(
  p_token text,
  p_title text,
  p_filename text,
  p_storage_path text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_premium public.client_premium;
  v_owner uuid;
  v_doc_id uuid;
  v_title_clean text;
begin
  select * into v_client from public.clients where share_token = p_token;
  if v_client.id is null then
    raise exception 'Lien invalide';
  end if;

  select * into v_premium from public.client_premium where client_id = v_client.id;
  if v_premium.client_id is null or not v_premium.enabled then
    raise exception 'Espace Premium non actif';
  end if;

  if p_storage_path is null or p_storage_path not like (v_client.id::text || '/%') then
    raise exception 'Chemin de fichier invalide';
  end if;

  v_title_clean := left(trim(coalesce(nullif(p_title, ''), p_filename)), 200);
  v_owner := v_client.user_id;

  insert into public.client_premium_documents
    (client_id, user_id, title, filename, storage_path, size_bytes, uploaded_by, visible_to_client)
  values
    (v_client.id, v_owner, v_title_clean, p_filename, p_storage_path, p_size_bytes, 'client', true)
  returning id into v_doc_id;

  insert into public.notifications (user_id, type, title, body, client_id)
  values (
    v_owner,
    'document',
    v_client.name || ' a ajouté un document',
    v_title_clean,
    v_client.id
  );

  return v_doc_id;
end;
$$;

revoke all on function public.add_client_premium_document(text, text, text, text, bigint) from public;
grant execute on function public.add_client_premium_document(text, text, text, text, bigint)
  to anon, authenticated, service_role;
