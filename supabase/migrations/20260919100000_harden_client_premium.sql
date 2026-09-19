-- Final hardening for Client Premium.
-- Restrict business-side reads/writes to editors and expose only the
-- explicitly shared Premium data through token-checked SECURITY DEFINER RPCs.

drop policy if exists "Authenticated read client_premium" on public.client_premium;
create policy "Editors read client_premium" on public.client_premium
for select to authenticated using (public.is_editor(auth.uid()));
drop policy if exists "Editors insert client_premium" on public.client_premium;
create policy "Editors insert client_premium" on public.client_premium
for insert to authenticated with check (public.is_editor(auth.uid()));
drop policy if exists "Editors update client_premium" on public.client_premium;
create policy "Editors update client_premium" on public.client_premium
for update to authenticated using (public.is_editor(auth.uid())) with check (public.is_editor(auth.uid()));
drop policy if exists "Editors delete client_premium" on public.client_premium;
create policy "Editors delete client_premium" on public.client_premium
for delete to authenticated using (public.is_editor(auth.uid()));

drop policy if exists "Authenticated read premium documents" on public.client_premium_documents;
create policy "Editors read premium documents" on public.client_premium_documents
for select to authenticated using (public.is_editor(auth.uid()));
drop policy if exists "Editors insert premium documents" on public.client_premium_documents;
create policy "Editors insert premium documents" on public.client_premium_documents
for insert to authenticated with check (public.is_editor(auth.uid()));
drop policy if exists "Editors update premium documents" on public.client_premium_documents;
create policy "Editors update premium documents" on public.client_premium_documents
for update to authenticated using (public.is_editor(auth.uid())) with check (public.is_editor(auth.uid()));
drop policy if exists "Editors delete premium documents" on public.client_premium_documents;
create policy "Editors delete premium documents" on public.client_premium_documents
for delete to authenticated using (public.is_editor(auth.uid()));

drop policy if exists "Authenticated read premium planning" on public.client_premium_planning_items;
create policy "Editors read premium planning" on public.client_premium_planning_items
for select to authenticated using (public.is_editor(auth.uid()));
drop policy if exists "Editors insert premium planning" on public.client_premium_planning_items;
create policy "Editors insert premium planning" on public.client_premium_planning_items
for insert to authenticated with check (public.is_editor(auth.uid()));
drop policy if exists "Editors update premium planning" on public.client_premium_planning_items;
create policy "Editors update premium planning" on public.client_premium_planning_items
for update to authenticated using (public.is_editor(auth.uid())) with check (public.is_editor(auth.uid()));
drop policy if exists "Editors delete premium planning" on public.client_premium_planning_items;
create policy "Editors delete premium planning" on public.client_premium_planning_items
for delete to authenticated using (public.is_editor(auth.uid()));

drop policy if exists "Premium editor read" on storage.objects;
create policy "Premium editor read" on storage.objects
for select to authenticated
using (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
drop policy if exists "Premium editor insert" on storage.objects;
create policy "Premium editor insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
drop policy if exists "Premium editor update" on storage.objects;
create policy "Premium editor update" on storage.objects
for update to authenticated
using (bucket_id = 'client-premium' and public.is_editor(auth.uid()))
with check (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
drop policy if exists "Premium editor delete" on storage.objects;
create policy "Premium editor delete" on storage.objects
for delete to authenticated
using (bucket_id = 'client-premium' and public.is_editor(auth.uid()));

create or replace function public.get_shared_premium(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client', jsonb_build_object(
      'id', c.id, 'name', c.name, 'email', c.email,
      'phone', c.phone, 'address', c.address
    ),
    'enabled', coalesce(p.enabled, false),
    'google_review_url', p.google_review_url,
    'commercial_note', p.commercial_note,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'client_id', d.client_id, 'kind', d.kind,
        'title', d.title, 'filename', d.filename,
        'storage_path', d.storage_path, 'size_bytes', d.size_bytes,
        'year', d.year, 'visible_to_client', d.visible_to_client,
        'created_at', d.created_at
      ) order by d.created_at desc)
      from public.client_premium_documents d
      where d.client_id = c.id and d.visible_to_client
    ), '[]'::jsonb),
    'planning', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'client_id', i.client_id, 'document_id', i.document_id,
        'label', i.label, 'period_label', i.period_label,
        'start_date', i.start_date, 'end_date', i.end_date,
        'year', i.year, 'status', i.status, 'source', i.source,
        'notes', i.notes, 'position', i.position
      ) order by i.year, i.position, i.start_date)
      from public.client_premium_planning_items i
      where i.client_id = c.id and i.status = 'valide'
    ), '[]'::jsonb)
  )
  from public.clients c
  left join public.client_premium p on p.client_id = c.id
  where c.share_token = p_token and coalesce(p.enabled, false);
$$;

revoke all on function public.get_shared_premium(text) from public;
grant execute on function public.get_shared_premium(text) to anon, authenticated, service_role;

create or replace function public.get_shared_premium_document_url(
  p_token text,
  p_document_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_url text;
begin
  select d.storage_path into v_path
  from public.client_premium_documents d
  join public.clients c on c.id = d.client_id
  join public.client_premium p on p.client_id = c.id
  where c.share_token = p_token
    and p.enabled
    and d.id = p_document_id
    and d.visible_to_client;

  if v_path is null then
    raise exception 'Document indisponible';
  end if;

  select signed_url into v_url
  from storage.create_signed_url('client-premium', v_path, 3600);

  return v_url;
end;
$$;

revoke all on function public.get_shared_premium_document_url(text, uuid) from public;
grant execute on function public.get_shared_premium_document_url(text, uuid)
to anon, authenticated, service_role;
