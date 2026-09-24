-- Chantier 3 — ajoute les interventions à venir (planning_notes) au payload
-- get_shared_premium, pour l'onglet Premium du dashboard client.

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
    ), '[]'::jsonb),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'scheduled_date', n.scheduled_date,
        'title', n.title,
        'details', n.details
      ) order by n.scheduled_date asc)
      from public.planning_notes n
      where n.client_id = c.id and n.scheduled_date >= current_date
    ), '[]'::jsonb)
  )
  from public.clients c
  left join public.client_premium p on p.client_id = c.id
  where c.share_token = p_token and coalesce(p.enabled, false);
$$;
