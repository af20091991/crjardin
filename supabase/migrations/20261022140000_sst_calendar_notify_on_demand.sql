-- Calendrier SST : la notification (cloche + e-mail) n'est plus automatique.
-- L'auteur de la modification choisit de notifier ou non les utilisateurs concernés.
-- notify_decision : null = en attente de décision, 'sent' = notifié, 'skipped' = pas de notification.

alter table public.sst_calendar_changes add column if not exists notify_decision text
  check (notify_decision in ('sent', 'skipped'));

-- Historique : ce qui est déjà parti par e-mail est 'sent' ; le reste n'a plus lieu d'être proposé.
update public.sst_calendar_changes set notify_decision = 'sent'
  where notify_decision is null and emailed_at is not null;
update public.sst_calendar_changes set notify_decision = 'skipped'
  where notify_decision is null;

create index if not exists sst_calendar_changes_pending_decision_idx
  on public.sst_calendar_changes (actor_id, created_at)
  where notify_decision is null;

-- L'auteur lit ses propres modifications en attente de décision.
drop policy if exists "Actors read own sst calendar changes" on public.sst_calendar_changes;
create policy "Actors read own sst calendar changes" on public.sst_calendar_changes
  for select to authenticated
  using (actor_id = auth.uid());

-- Le journal s'enregistre toujours, mais ne crée plus d'alerte dans la cloche :
-- les alertes sont créées par l'application quand l'auteur choisit de notifier.
create or replace function public.sst_calendar_record_change(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_date date,
  p_summary text,
  p_details jsonb,
  p_owner uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sst_calendar_changes
    (actor_id, actor_label, entity, entity_id, action, calendar_date, summary, details, owner_id)
  values
    (auth.uid(), public.sst_calendar_actor_label(auth.uid()), p_entity, p_entity_id, p_action,
     p_date, p_summary, coalesce(p_details, '[]'::jsonb), p_owner);
end;
$$;
