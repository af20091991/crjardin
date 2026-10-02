-- Calendrier SST : journal de TOUTES les modifications + alerte dans l'appli (notifications)
-- pour les administrateurs. L'e-mail est envoyé par l'application à partir de ce journal.

create table if not exists public.sst_calendar_changes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_label text not null default 'Un utilisateur',
  entity text not null check (entity in ('availability', 'worksite')),
  entity_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  calendar_date date,
  summary text not null,
  details jsonb not null default '[]'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  emailed_at timestamptz
);

create index if not exists sst_calendar_changes_pending_idx
  on public.sst_calendar_changes (created_at desc)
  where acknowledged_at is null;
create index if not exists sst_calendar_changes_unsent_idx
  on public.sst_calendar_changes (created_at)
  where emailed_at is null;

alter table public.sst_calendar_changes enable row level security;

drop policy if exists "Admins read sst calendar changes" on public.sst_calendar_changes;
create policy "Admins read sst calendar changes" on public.sst_calendar_changes
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins acknowledge sst calendar changes" on public.sst_calendar_changes;
create policy "Admins acknowledge sst calendar changes" on public.sst_calendar_changes
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.sst_calendar_actor_label(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.display_name), ''),
    nullif(trim(p.company_name), ''),
    'Un utilisateur'
  )
  from (select 1) x
  left join public.profiles p on p.id = p_user;
$$;

create or replace function public.sst_calendar_record_change(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_date date,
  p_summary text,
  p_details jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_label text := public.sst_calendar_actor_label(auth.uid());
begin
  insert into public.sst_calendar_changes
    (actor_id, actor_label, entity, entity_id, action, calendar_date, summary, details)
  values
    (v_actor, v_label, p_entity, p_entity_id, p_action, p_date, p_summary, coalesce(p_details, '[]'::jsonb));

  -- Alerte dans l'appli (cloche) pour chaque administrateur, sauf l'auteur de la modification.
  insert into public.notifications (user_id, type, title, body)
  select r.user_id, 'sst_calendar', p_summary,
         nullif(
           (select string_agg(
              case when d->>'from' is null and d->>'to' is null then d->>'label'
                   else (d->>'label') || ' : ' || coalesce(d->>'from', '—') || ' → ' || coalesce(d->>'to', '—') end,
              ' · ')
            from jsonb_array_elements(coalesce(p_details, '[]'::jsonb)) d),
           '')
  from public.user_roles r
  where r.role = 'admin' and r.user_id is distinct from v_actor;
end;
$$;

create or replace function public.sst_availability_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := public.sst_calendar_actor_label(auth.uid());
  v_date date;
  v_details jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.sst_calendar_record_change(
      'availability', new.id, 'created', new.date,
      v_label || ' s''est déclaré(e) disponible le ' || to_char(new.date, 'DD/MM/YYYY'),
      case when new.comment is null then '[]'::jsonb
           else jsonb_build_array(jsonb_build_object('label', 'Commentaire', 'from', null, 'to', new.comment)) end);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.date is not distinct from old.date and new.comment is not distinct from old.comment then
      return new;
    end if;
    if new.date is distinct from old.date then
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'label', 'Date', 'from', to_char(old.date, 'DD/MM/YYYY'), 'to', to_char(new.date, 'DD/MM/YYYY')));
    end if;
    if new.comment is distinct from old.comment then
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'label', 'Commentaire', 'from', old.comment, 'to', new.comment));
    end if;
    perform public.sst_calendar_record_change(
      'availability', new.id, 'updated', new.date,
      v_label || ' a modifié une disponibilité du ' || to_char(new.date, 'DD/MM/YYYY'),
      v_details);
    return new;
  else
    v_date := old.date;
    perform public.sst_calendar_record_change(
      'availability', old.id, 'deleted', v_date,
      v_label || ' a retiré une disponibilité du ' || to_char(v_date, 'DD/MM/YYYY'),
      case when old.comment is null then '[]'::jsonb
           else jsonb_build_array(jsonb_build_object('label', 'Commentaire', 'from', old.comment, 'to', null)) end);
    return old;
  end if;
end;
$$;

drop trigger if exists sst_availability_log_change on public.sst_availability_calendar;
create trigger sst_availability_log_change
  after insert or update or delete on public.sst_availability_calendar
  for each row execute function public.sst_availability_log_change();

create or replace function public.worksite_sheet_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := public.sst_calendar_actor_label(auth.uid());
  v_name text;
  v_details jsonb := '[]'::jsonb;
  v_key text;
  v_old jsonb;
  v_new jsonb;
  v_ignored text[] := array['updated_at', 'created_at', 'photos', 'garden_markers', 'latitude', 'longitude', 'user_id', 'id'];
  v_labels jsonb := jsonb_build_object(
    'intervention_date', 'Date d''intervention',
    'planning_status', 'Statut du planning',
    'intervenant', 'Intervenant',
    'estimated_hours', 'Heures estimées',
    'required_people', 'Personnes requises',
    'client_name', 'Client',
    'address', 'Adresse',
    'access_complement', 'Complément d''accès',
    'contact_person', 'Contact sur place',
    'client_phone', 'Téléphone',
    'client_phone_backup', 'Téléphone de secours',
    'client_present', 'Client présent',
    'green_waste', 'Déchets verts',
    'notes', 'Notes',
    'tasks', 'Tâches',
    'equipment', 'Matériel',
    'epi', 'EPI',
    'checklist', 'Check-list',
    'recycling_center', 'Déchetterie',
    'site_id', 'Site',
    'client_id', 'Fiche client',
    'civility', 'Civilité');
begin
  if tg_op = 'INSERT' then
    if new.intervention_date is null then return new; end if;
    perform public.sst_calendar_record_change(
      'worksite', new.id, 'created', new.intervention_date,
      v_label || ' a ajouté le chantier ' || coalesce(nullif(new.client_name, ''), 'sans nom') ||
        ' au planning du ' || to_char(new.intervention_date, 'DD/MM/YYYY'),
      '[]'::jsonb);
    return new;
  elsif tg_op = 'DELETE' then
    if old.intervention_date is null then return old; end if;
    perform public.sst_calendar_record_change(
      'worksite', old.id, 'deleted', old.intervention_date,
      v_label || ' a retiré le chantier ' || coalesce(nullif(old.client_name, ''), 'sans nom') ||
        ' du planning du ' || to_char(old.intervention_date, 'DD/MM/YYYY'),
      '[]'::jsonb);
    return old;
  end if;

  if new.intervention_date is null and old.intervention_date is null then return new; end if;
  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  for v_key in select jsonb_object_keys(v_new) loop
    continue when v_key = any (v_ignored);
    continue when v_old -> v_key is not distinct from v_new -> v_key;
    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'label', coalesce(v_labels ->> v_key, v_key),
      'from', case when jsonb_typeof(v_old -> v_key) in ('object', 'array') then null else v_old ->> v_key end,
      'to', case when jsonb_typeof(v_new -> v_key) in ('object', 'array') then 'modifié' else v_new ->> v_key end));
  end loop;
  if jsonb_array_length(v_details) = 0 then return new; end if;

  v_name := coalesce(nullif(new.client_name, ''), 'sans nom');
  perform public.sst_calendar_record_change(
    'worksite', new.id, 'updated', coalesce(new.intervention_date, old.intervention_date),
    v_label || ' a modifié le chantier ' || v_name || ' (' ||
      to_char(coalesce(new.intervention_date, old.intervention_date), 'DD/MM/YYYY') || ')',
    v_details);
  return new;
end;
$$;

drop trigger if exists worksite_sheet_log_change on public.worksite_sheets;
create trigger worksite_sheet_log_change
  after insert or update or delete on public.worksite_sheets
  for each row execute function public.worksite_sheet_log_change();
