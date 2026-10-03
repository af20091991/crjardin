-- Messagerie Premium : clôture/archivage des conversations.
-- Une conversation ouverte = messages d'un client avec archived_at NULL ;
-- clôturer = poser la même date archived_at sur tous ses messages ouverts.
alter table public.client_messages
  add column if not exists archived_at timestamptz;

create index if not exists client_messages_client_archived_idx
  on public.client_messages (client_id, archived_at);

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
      'archived_at', m.archived_at
    ) order by m.created_at asc)
    from public.client_messages m
    where m.client_id = v_client.id
  ), '[]'::jsonb);
end;
$function$;
