-- Demande d'intervention depuis l'espace client : nouveau type de message « demande ».
-- Reprend add_client_message (20260920120000) en ajoutant ce type. Idempotent.

create or replace function public.add_client_message(
  p_token text,
  p_intervention_id uuid,
  p_kind text,
  p_content text,
  p_author_name text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_client public.clients;
  v_owner uuid;
  v_msg_id uuid;
  v_kind text;
  v_content_clean text;
begin
  select * into v_client from public.clients where share_token = p_token;
  if v_client.id is null then raise exception 'Lien invalide'; end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception 'Message vide'; end if;

  v_kind := case when p_kind in ('question', 'demande') then p_kind else 'annotation' end;
  v_content_clean := left(trim(p_content), 2000);

  if p_intervention_id is not null then
    select user_id into v_owner from public.interventions
    where id = p_intervention_id and client_id = v_client.id;
  end if;
  v_owner := coalesce(v_owner, v_client.user_id);

  insert into public.client_messages (client_id, intervention_id, kind, content, author_name)
  values (v_client.id, p_intervention_id, v_kind, v_content_clean, p_author_name)
  returning id into v_msg_id;

  insert into public.notifications (user_id, type, title, body, client_id, intervention_id)
  values (
    v_owner,
    v_kind,
    v_client.name || (case
      when v_kind = 'question' then ' a posé une question'
      when v_kind = 'demande' then ' demande une intervention'
      else ' a ajouté une annotation' end),
    left(trim(p_content), 300),
    v_client.id,
    p_intervention_id
  );

  return v_msg_id;
end;
$function$;
