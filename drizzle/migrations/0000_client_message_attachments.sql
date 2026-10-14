-- Pièces jointes des échanges client ↔ entreprise (bucket privé chat-attachments).
alter table public.client_messages add column if not exists client_request_id uuid;
create unique index if not exists client_messages_request_id_key
  on public.client_messages (client_request_id) where client_request_id is not null;

create or replace function public.is_allowed_chat_attachment_mime(p_mime text)
returns boolean language sql immutable set search_path = public as $$
  select p_mime = any (array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'application/pdf','text/plain','text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]);
$$;

create table public.client_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.client_messages(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);
create index client_message_attachments_message_idx on public.client_message_attachments (message_id);
create index client_message_attachments_client_idx on public.client_message_attachments (client_id);

grant select, insert, delete on public.client_message_attachments to authenticated;
grant all on public.client_message_attachments to service_role;
alter table public.client_message_attachments enable row level security;

create or replace function public.validate_chat_attachment()
returns trigger language plpgsql set search_path = public as $$
declare v_msg_client uuid;
begin
  if new.uploaded_by not in ('client','gardener') then raise exception 'Expéditeur invalide'; end if;
  if new.size_bytes <= 0 or new.size_bytes > 10485760 then raise exception 'Fichier trop volumineux (10 Mo maximum)'; end if;
  if not public.is_allowed_chat_attachment_mime(new.mime_type) then raise exception 'Type de fichier non autorisé'; end if;
  select client_id into v_msg_client from public.client_messages where id = new.message_id;
  if v_msg_client is null or v_msg_client <> new.client_id then raise exception 'Message invalide'; end if;
  if new.storage_path not like (new.client_id::text || '/%') then raise exception 'Chemin de fichier invalide'; end if;
  new.filename := left(new.filename, 200);
  return new;
end; $$;
create trigger client_message_attachments_validate
  before insert on public.client_message_attachments
  for each row execute function public.validate_chat_attachment();

create policy "Read chat attachments like messages" on public.client_message_attachments
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'observateur')
    or exists (select 1 from public.clients c where c.id = client_message_attachments.client_id and c.user_id = auth.uid())
  );
create policy "Editors add gardener attachments" on public.client_message_attachments
  for insert to authenticated with check (public.is_editor(auth.uid()) and uploaded_by = 'gardener');
create policy "Editors delete chat attachments" on public.client_message_attachments
  for delete to authenticated using (public.is_editor(auth.uid()));

-- Stockage : jamais d'accès anonyme ; les clients passent par des URL signées émises côté serveur.
create policy "Chat attachments read" on storage.objects for select to authenticated using (
  bucket_id = 'chat-attachments' and (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'observateur')
    or exists (select 1 from public.clients c where c.id::text = (storage.foldername(name))[1] and c.user_id = auth.uid())
  ));
create policy "Chat attachments editor insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and public.is_editor(auth.uid()));
create policy "Chat attachments editor update" on storage.objects for update to authenticated
  using (bucket_id = 'chat-attachments' and public.is_editor(auth.uid()))
  with check (bucket_id = 'chat-attachments' and public.is_editor(auth.uid()));
create policy "Chat attachments editor delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and public.is_editor(auth.uid()));

-- Envoi client (lien de partage) : message + pièces jointes, atomique et idempotent.
create or replace function public.add_client_message_with_attachments(
  p_token text, p_intervention_id uuid, p_kind text, p_content text, p_author_name text,
  p_request_id uuid, p_attachments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
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
end; $$;
revoke all on function public.add_client_message_with_attachments(text, uuid, text, text, text, uuid, jsonb) from public;
grant execute on function public.add_client_message_with_attachments(text, uuid, text, text, text, uuid, jsonb) to anon, authenticated, service_role;

-- Lecture côté client : ajoute les métadonnées des pièces jointes (sans URL ; signées côté serveur).
create or replace function public.get_shared_messages(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v_client public.clients;
begin
  select * into v_client from public.clients where share_token = p_token;
  if v_client.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'intervention_id', m.intervention_id, 'kind', m.kind, 'content', m.content,
      'author_name', m.author_name, 'sender', m.sender, 'created_at', m.created_at,
      'archived_at', m.archived_at,
      'attachments', coalesce((select jsonb_agg(jsonb_build_object(
          'id', x.id, 'storage_path', x.storage_path, 'filename', x.filename,
          'mime_type', x.mime_type, 'size_bytes', x.size_bytes) order by x.created_at)
        from public.client_message_attachments x where x.message_id = m.id), '[]'::jsonb)
    ) order by m.created_at asc)
    from public.client_messages m where m.client_id = v_client.id
  ), '[]'::jsonb);
end; $function$;