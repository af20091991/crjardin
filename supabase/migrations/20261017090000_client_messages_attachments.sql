-- Messagerie Premium : pièce jointe (photo ou PDF) sur un message.
-- Le fichier vit dans le bucket privé « client-premium » (même dossier que les documents du client)
-- et est aussi enregistré dans client_premium_documents pour apparaître dans « Photos et Documents ».
alter table public.client_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size bigint;

-- Même signature que la version précédente : expose en plus les champs de pièce jointe.
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
      'attachment_name', m.attachment_name,
      'attachment_size', m.attachment_size,
      'has_attachment', m.attachment_path is not null
    ) order by m.created_at asc)
    from public.client_messages m
    where m.client_id = v_client.id
  ), '[]'::jsonb);
end;
$function$;
