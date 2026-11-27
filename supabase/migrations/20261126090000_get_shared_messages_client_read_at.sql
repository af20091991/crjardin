-- Badge « +N » sur la messagerie Premium : le client voit les messages du gérant non ouverts.
-- Ajoute client_read_at à la sortie de get_shared_messages. Idempotent (CREATE OR REPLACE,
-- les droits EXECUTE existants sont conservés : révoqués pour anon/authenticated).

create or replace function public.get_shared_messages(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_client public.clients;
begin
  select * into v_client from public.clients where share_token = p_token;
  if v_client.id is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'intervention_id', m.intervention_id,
      'kind', m.kind,
      'content', m.content,
      'author_name', m.author_name,
      'sender', m.sender,
      'created_at', m.created_at,
      'archived_at', m.archived_at,
      'client_read_at', m.client_read_at,
      'attachment_name', m.attachment_name,
      'attachment_size', m.attachment_size,
      'has_attachment', m.attachment_path is not null
    ) order by m.created_at asc)
    from public.client_messages m
    where m.client_id = v_client.id
  ), '[]'::jsonb);
end;
$function$;
