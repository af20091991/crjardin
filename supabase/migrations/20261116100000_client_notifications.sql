-- File d'attente des notifications destinées aux clients Premium.
-- Chaque évènement pertinent crée une ligne « pending » ; rien n'est envoyé
-- tant que le gérant n'a pas choisi « Envoyer » (e-mail + notification espace client).

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('cr','recommendation','document','photos','calendar','garden','message')),
  title text not null,
  body text,
  source_key text not null unique,
  status text not null default 'pending' check (status in ('pending','sent','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  sent_at timestamptz
);

create index if not exists client_notifications_client_status_idx
  on public.client_notifications(client_id, status, created_at desc);

grant select, update, delete on public.client_notifications to authenticated;
grant all on public.client_notifications to service_role;

alter table public.client_notifications enable row level security;

drop policy if exists "Admins read client notifications" on public.client_notifications;
DROP POLICY IF EXISTS "Admins read client notifications" ON public.client_notifications;
CREATE POLICY "Admins read client notifications" ON public.client_notifications
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update client notifications" on public.client_notifications;
DROP POLICY IF EXISTS "Admins update client notifications" ON public.client_notifications;
CREATE POLICY "Admins update client notifications" ON public.client_notifications
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins delete client notifications" on public.client_notifications;
DROP POLICY IF EXISTS "Admins delete client notifications" ON public.client_notifications;
CREATE POLICY "Admins delete client notifications" ON public.client_notifications
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Insertion uniquement par les déclencheurs ci-dessous (SECURITY DEFINER).
create or replace function public.enqueue_client_notification(
  p_client uuid, p_kind text, p_title text, p_body text, p_source text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_client is null then return; end if;
  insert into public.client_notifications (client_id, kind, title, body, source_key)
  values (p_client, p_kind, left(p_title, 200), left(p_body, 500), p_source)
  on conflict (source_key) do nothing;
end $$;

-- Nouvelle préconisation
create or replace function public.notify_client_reco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_client_notification(new.client_id, 'recommendation',
    'Nouvelle préconisation : ' || new.title, new.description, 'reco:' || new.id);
  return new;
end $$;
drop trigger if exists trg_notify_client_reco on public.recommendations;
create trigger trg_notify_client_reco after insert on public.recommendations
  for each row execute function public.notify_client_reco();

-- Compte-rendu envoyé au client
create or replace function public.notify_client_cr() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_client_notification(new.client_id, 'cr',
    'Nouveau compte-rendu : ' || coalesce(new.title, new.intervention_type, 'intervention'),
    new.summary, 'cr:' || new.id || ':' || extract(epoch from new.sent_to_client_at)::bigint);
  return new;
end $$;
drop trigger if exists trg_notify_client_cr on public.interventions;
create trigger trg_notify_client_cr after update of sent_to_client_at on public.interventions
  for each row when (new.sent_to_client_at is not null and new.sent_to_client_at is distinct from old.sent_to_client_at)
  execute function public.notify_client_cr();

-- Photos ajoutées à un compte-rendu (une notification par intervention)
create or replace function public.notify_client_photos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.include_in_report, false) then
    perform public.enqueue_client_notification(new.client_id, 'photos',
      'Nouvelles photos de votre jardin', 'Des photos ont été ajoutées à une intervention.',
      'photos:' || new.intervention_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_client_photos on public.intervention_photos;
create trigger trg_notify_client_photos after insert on public.intervention_photos
  for each row execute function public.notify_client_photos();

-- Document déposé par le gérant
create or replace function public.notify_client_document() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.uploaded_by = 'gardener' and coalesce(new.visible_to_client, false) then
    perform public.enqueue_client_notification(new.client_id, 'document',
      'Nouveau document : ' || new.title, null, 'document:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_client_document on public.client_premium_documents;
create trigger trg_notify_client_document after insert on public.client_premium_documents
  for each row execute function public.notify_client_document();

-- Message du jardinier dans la messagerie
create or replace function public.notify_client_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'gardener' then
    perform public.enqueue_client_notification(new.client_id, 'message',
      'Nouveau message de votre jardinier', new.content, 'message:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_client_message on public.client_messages;
create trigger trg_notify_client_message after insert on public.client_messages
  for each row execute function public.notify_client_message();

-- Calendrier travaux modifié : au plus une notification par client et par jour
create or replace function public.notify_client_calendar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_client_notification(new.client_id, 'calendar',
    'Votre calendrier travaux a été mis à jour', new.title,
    'calendar:' || new.client_id || ':' || current_date);
  return new;
end $$;
drop trigger if exists trg_notify_client_calendar on public.client_premium_work_calendar_items;
create trigger trg_notify_client_calendar after insert or update on public.client_premium_work_calendar_items
  for each row execute function public.notify_client_calendar();

-- État du jardin mis à jour (une notification par client et par jour)
create or replace function public.notify_client_garden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.garden_state is distinct from old.garden_state
     or new.garden_objectives is distinct from old.garden_objectives
     or new.garden_specificities is distinct from old.garden_specificities then
    perform public.enqueue_client_notification(new.client_id, 'garden',
      'Le suivi de votre jardin a été mis à jour', new.garden_state,
      'garden:' || new.client_id || ':' || current_date);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_client_garden on public.client_premium;
create trigger trg_notify_client_garden after update on public.client_premium
  for each row execute function public.notify_client_garden();

-- Lecture côté client : seulement les notifications envoyées par le gérant.
create or replace function public.get_shared_notifications(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'sent_at', n.sent_at
  ) order by n.sent_at desc), '[]'::jsonb)
  from public.client_notifications n
  join public.clients c on c.id = n.client_id
  where c.share_token = p_token and n.status = 'sent'
    and n.sent_at > now() - interval '90 days';
$$;
grant execute on function public.get_shared_notifications(text) to anon, authenticated, service_role;
