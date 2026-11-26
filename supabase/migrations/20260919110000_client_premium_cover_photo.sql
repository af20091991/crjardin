create or replace function public.get_shared_premium(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'email', c.email,
      'phone', c.phone,
      'address', c.address
    ),
    'enabled', coalesce(p.enabled, false),
    'cover_photo_id', p.cover_photo_id,
    'google_review_url', p.google_review_url,
    'commercial_note', p.commercial_note,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'client_id', d.client_id,
        'kind', d.kind,
        'title', d.title,
        'filename', d.filename,
        'storage_path', d.storage_path,
        'size_bytes', d.size_bytes,
        'year', d.year,
        'visible_to_client', d.visible_to_client,
        'created_at', d.created_at
      ) order by d.created_at desc)
      from public.client_premium_documents d
      where d.client_id = c.id and d.visible_to_client
    ), '[]'::jsonb),
    'planning', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'client_id', i.client_id,
        'document_id', i.document_id,
        'label', i.label,
        'period_label', i.period_label,
        'start_date', i.start_date,
        'end_date', i.end_date,
        'year', i.year,
        'status', i.status,
        'source', i.source,
        'notes', i.notes,
        'position', i.position
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