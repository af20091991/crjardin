-- Fonction d'envoi de message avec pièces jointes (lien partagé client).
-- Présente en production mais absente du dépôt : reconstruite à l'identique. Idempotent.
CREATE OR REPLACE FUNCTION public.add_client_message_with_attachments(p_token text, p_intervention_id uuid, p_kind text, p_content text, p_author_name text, p_request_id uuid, p_attachments jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client public.clients; v_owner uuid; v_msg_id uuid; v_kind text; v_content text;
  v_count int; a jsonb;
begin
  select * into v_client from public.clients where share_token = p_token;
  if v_client.id is null then raise exception 'Lien invalide'; end if;
  if p_request_id is null then raise exception 'Identifiant d''envoi manquant'; end if;

  select id into v_msg_id from public.client_messages where client_request_id = p_request_id;
  if v_msg_id is not null then
    if not exists (select 1 from public.client_messages where id = v_msg_id and client_id = v_client.id) then
      raise exception 'Identifiant d''envoi invalide';
    end if;
    return v_msg_id; -- réessai : pas de doublon
  end if;

  v_count := coalesce(jsonb_array_length(p_attachments), 0);
  if v_count > 5 then raise exception '5 pièces jointes maximum'; end if;
  v_content := left(trim(coalesce(p_content, '')), 2000);
  if length(v_content) = 0 and v_count = 0 then raise exception 'Message vide'; end if;
  v_kind := case when p_kind = 'question' then 'question' else 'annotation' end;

  if p_intervention_id is not null then
    select user_id into v_owner from public.interventions where id = p_intervention_id and client_id = v_client.id;
    if v_owner is null then raise exception 'Intervention invalide'; end if;
  end if;
  v_owner := coalesce(v_owner, v_client.user_id);

  insert into public.client_messages (client_id, intervention_id, kind, content, author_name, client_request_id)
  values (v_client.id, p_intervention_id, v_kind, v_content, p_author_name, p_request_id)
  returning id into v_msg_id;

  for a in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    if (a->>'storage_path') not like (v_client.id::text || '/' || p_request_id::text || '/%') then
      raise exception 'Chemin de fichier invalide';
    end if;
    insert into public.client_message_attachments (message_id, client_id, storage_path, filename, mime_type, size_bytes, uploaded_by)
    values (v_msg_id, v_client.id, a->>'storage_path', a->>'filename', a->>'mime_type', (a->>'size_bytes')::bigint, 'client');
  end loop;

  insert into public.notifications (user_id, type, title, body, client_id, intervention_id)
  values (v_owner, v_kind,
    v_client.name || (case when v_kind = 'question' then ' a posé une question' else ' a ajouté une annotation' end),
    left(case when length(v_content) > 0 then v_content else v_count || ' pièce(s) jointe(s)' end, 300),
    v_client.id, p_intervention_id);
  return v_msg_id;
end; $function$;
