-- Chantier 1 — Fondations DB du nouveau module Client Premium.
-- Reconstruction from scratch après suppression complète (PR #145).

-- === Tables ===

create table public.client_premium (
  client_id uuid primary key references public.clients(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  enabled boolean not null default false,
  activated_at timestamptz,
  deactivated_at timestamptz,
  garden_state text,
  google_review_url text,
  commercial_note text,
  cover_photo_id uuid references public.intervention_photos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_premium_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  title text not null,
  filename text not null,
  storage_path text not null,
  size_bytes bigint,
  uploaded_by text not null default 'gardener' check (uploaded_by in ('gardener', 'client')),
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_premium_documents_client_idx
  on public.client_premium_documents (client_id, created_at desc);

-- === RLS ===

alter table public.client_premium enable row level security;
alter table public.client_premium_documents enable row level security;

create policy "Editors read client_premium"
  on public.client_premium for select to authenticated
  using (public.is_editor(auth.uid()));
create policy "Editors insert client_premium"
  on public.client_premium for insert to authenticated
  with check (user_id = auth.uid() and public.is_editor(auth.uid()));
create policy "Editors update client_premium"
  on public.client_premium for update to authenticated
  using (public.is_editor(auth.uid())) with check (public.is_editor(auth.uid()));
create policy "Editors delete client_premium"
  on public.client_premium for delete to authenticated
  using (public.is_editor(auth.uid()));

create policy "Editors read premium documents"
  on public.client_premium_documents for select to authenticated
  using (public.is_editor(auth.uid()));
create policy "Editors insert premium documents"
  on public.client_premium_documents for insert to authenticated
  with check (user_id = auth.uid() and public.is_editor(auth.uid()));
create policy "Editors update premium documents"
  on public.client_premium_documents for update to authenticated
  using (public.is_editor(auth.uid())) with check (public.is_editor(auth.uid()));
create policy "Editors delete premium documents"
  on public.client_premium_documents for delete to authenticated
  using (public.is_editor(auth.uid()));

-- === Storage ===

insert into storage.buckets (id, name, public, file_size_limit)
values ('client-premium', 'client-premium', false, 26214400)
on conflict (id) do nothing;

create policy "Premium editor read"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
create policy "Premium editor insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
create policy "Premium editor update"
  on storage.objects for update to authenticated
  using (bucket_id = 'client-premium' and public.is_editor(auth.uid()))
  with check (bucket_id = 'client-premium' and public.is_editor(auth.uid()));
create policy "Premium editor delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-premium' and public.is_editor(auth.uid()));

-- === RPC publiques (accès client via share_token, sans compte) ===

create or replace function public.get_shared_premium(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', coalesce(p.enabled, false),
    'garden_state', p.garden_state,
    'google_review_url', p.google_review_url,
    'commercial_note', p.commercial_note,
    'cover_photo_id', p.cover_photo_id,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'filename', d.filename,
        'storage_path', d.storage_path,
        'size_bytes', d.size_bytes,
        'uploaded_by', d.uploaded_by,
        'created_at', d.created_at
      ) order by d.created_at desc)
      from public.client_premium_documents d
      where d.client_id = c.id and d.visible_to_client
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
