create table public.sst_user_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subcontractor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_user_links TO authenticated;
GRANT ALL ON public.sst_user_links TO service_role;

alter table public.sst_user_links enable row level security;

create policy "Admins manage SST user links"
on public.sst_user_links
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Users read own SST links"
on public.sst_user_links
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.is_linked_to_subcontractor(_user_id uuid, _subcontractor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sst_user_links l
    where l.user_id = _user_id
      and l.subcontractor_id = _subcontractor_id
      and l.active = true
  )
$$;

create table public.sst_availabilities (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  availability_date date not null,
  start_time time,
  end_time time,
  status text not null default 'available' check (status in ('available', 'unavailable', 'partial', 'to_confirm')),
  comment text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or end_time is null or start_time < end_time)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_availabilities TO authenticated;
GRANT ALL ON public.sst_availabilities TO service_role;

alter table public.sst_availabilities enable row level security;

create policy "Authenticated read SST availabilities"
on public.sst_availabilities
for select
to authenticated
using (true);

create policy "Admins insert SST availabilities"
on public.sst_availabilities
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Linked SST insert own availabilities"
on public.sst_availabilities
for insert
to authenticated
with check (created_by = auth.uid() and public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create policy "Admins update SST availabilities"
on public.sst_availabilities
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Linked SST update own availabilities"
on public.sst_availabilities
for update
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id))
with check (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create policy "Admins delete SST availabilities"
on public.sst_availabilities
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Linked SST delete own availabilities"
on public.sst_availabilities
for delete
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create table public.sst_availability_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  start_date date not null,
  end_date date not null,
  intervention_type text,
  comment text,
  response_deadline date,
  status text not null default 'pending' check (status in ('pending', 'answered', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_availability_requests TO authenticated;
GRANT ALL ON public.sst_availability_requests TO service_role;

alter table public.sst_availability_requests enable row level security;

create table public.sst_availability_request_targets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sst_availability_requests(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'answered', 'expired', 'cancelled')),
  response_comment text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, subcontractor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_availability_request_targets TO authenticated;
GRANT ALL ON public.sst_availability_request_targets TO service_role;

alter table public.sst_availability_request_targets enable row level security;

create policy "Admins manage availability requests"
on public.sst_availability_requests
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Targeted SST read availability requests"
on public.sst_availability_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.sst_availability_request_targets t
    where t.request_id = sst_availability_requests.id
      and public.is_linked_to_subcontractor(auth.uid(), t.subcontractor_id)
  )
);

create policy "Admins manage availability request targets"
on public.sst_availability_request_targets
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Targeted SST read own availability request targets"
on public.sst_availability_request_targets
for select
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create policy "Targeted SST update own availability request targets"
on public.sst_availability_request_targets
for update
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id))
with check (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create table public.sst_intervention_assignments (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  mission_id uuid references public.subcontractor_missions(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  required_people integer not null default 1 check (required_people > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'proposed' check (status in ('to_plan', 'proposed', 'to_confirm', 'confirmed', 'in_progress', 'done', 'report_due', 'closed', 'cancelled', 'refused', 'verify')),
  planning_comment text,
  response_comment text,
  proposed_at timestamptz,
  responded_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((intervention_id is not null) <> (mission_id is not null)),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_intervention_assignments TO authenticated;
GRANT ALL ON public.sst_intervention_assignments TO service_role;

alter table public.sst_intervention_assignments enable row level security;

create policy "Admins manage SST assignments"
on public.sst_intervention_assignments
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Linked SST read own assignments"
on public.sst_intervention_assignments
for select
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create policy "Linked SST update own assignment responses"
on public.sst_intervention_assignments
for update
to authenticated
using (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id))
with check (public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create table public.sst_calendar_settings (
  id boolean primary key default true,
  availability_horizon_months integer not null default 3 check (availability_horizon_months > 0),
  reminder_lead_months integer not null default 1 check (reminder_lead_months >= 0),
  confirmation_deadline_days integer not null default 3 check (confirmation_deadline_days >= 0),
  intervention_reminder_days integer not null default 1 check (intervention_reminder_days >= 0),
  notifications_enabled boolean not null default true,
  shared_view_options jsonb not null default '{}'::jsonb,
  colors jsonb not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_calendar_settings TO authenticated;
GRANT ALL ON public.sst_calendar_settings TO service_role;

alter table public.sst_calendar_settings enable row level security;

create policy "Authenticated read SST calendar settings"
on public.sst_calendar_settings
for select
to authenticated
using (true);

create policy "Admins manage SST calendar settings"
on public.sst_calendar_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.sst_calendar_settings (id) values (true)
on conflict (id) do nothing;

create table public.sst_calendar_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  object_type text not null,
  object_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.sst_calendar_audit_log TO authenticated;
GRANT ALL ON public.sst_calendar_audit_log TO service_role;

alter table public.sst_calendar_audit_log enable row level security;

create policy "Admins read SST audit log"
on public.sst_calendar_audit_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Authenticated insert SST audit log"
on public.sst_calendar_audit_log
for insert
to authenticated
with check (actor_user_id = auth.uid());

create table public.sst_calendar_conflicts (
  id uuid primary key default gen_random_uuid(),
  conflict_type text not null check (conflict_type in ('unavailable', 'overlap', 'outside_availability', 'understaffed', 'late_confirmation', 'missing_report')),
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  subcontractor_id uuid references public.subcontractors(id) on delete cascade,
  intervention_id uuid references public.interventions(id) on delete cascade,
  mission_id uuid references public.subcontractor_missions(id) on delete cascade,
  assignment_id uuid references public.sst_intervention_assignments(id) on delete cascade,
  conflict_date date,
  message text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_calendar_conflicts TO authenticated;
GRANT ALL ON public.sst_calendar_conflicts TO service_role;

alter table public.sst_calendar_conflicts enable row level security;

create policy "Admins manage SST conflicts"
on public.sst_calendar_conflicts
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Linked SST read own conflicts"
on public.sst_calendar_conflicts
for select
to authenticated
using (subcontractor_id is not null and public.is_linked_to_subcontractor(auth.uid(), subcontractor_id));

create or replace function public.enforce_sst_target_response_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.request_id is distinct from old.request_id
    or new.subcontractor_id is distinct from old.subcontractor_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée';
  end if;

  if new.status not in ('pending', 'answered') then
    raise exception 'Statut non autorisé';
  end if;

  new.updated_at = now();
  if new.status = 'answered' and old.status is distinct from 'answered' then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.enforce_sst_assignment_response_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.intervention_id is distinct from old.intervention_id
    or new.mission_id is distinct from old.mission_id
    or new.subcontractor_id is distinct from old.subcontractor_id
    or new.required_people is distinct from old.required_people
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.planning_comment is distinct from old.planning_comment
    or new.proposed_at is distinct from old.proposed_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée';
  end if;

  if new.status not in ('confirmed', 'refused', 'verify', 'to_confirm') then
    raise exception 'Statut non autorisé';
  end if;

  new.updated_at = now();
  if new.status is distinct from old.status then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

create trigger trg_sst_availabilities_updated_at
before update on public.sst_availabilities
for each row execute function public.update_updated_at_column();

create trigger trg_sst_availability_requests_updated_at
before update on public.sst_availability_requests
for each row execute function public.update_updated_at_column();

create trigger trg_sst_availability_request_targets_response
before update on public.sst_availability_request_targets
for each row execute function public.enforce_sst_target_response_update();

create trigger trg_sst_intervention_assignments_response
before update on public.sst_intervention_assignments
for each row execute function public.enforce_sst_assignment_response_update();

create trigger trg_sst_calendar_settings_updated_at
before update on public.sst_calendar_settings
for each row execute function public.update_updated_at_column();

create trigger trg_sst_calendar_conflicts_updated_at
before update on public.sst_calendar_conflicts
for each row execute function public.update_updated_at_column();

create index idx_sst_user_links_user on public.sst_user_links(user_id) where active;
create index idx_sst_availabilities_period on public.sst_availabilities(availability_date, subcontractor_id);
create index idx_sst_availability_targets_subcontractor on public.sst_availability_request_targets(subcontractor_id, status);
create index idx_sst_assignments_intervention on public.sst_intervention_assignments(intervention_id);
create index idx_sst_assignments_mission on public.sst_intervention_assignments(mission_id);
create index idx_sst_assignments_subcontractor on public.sst_intervention_assignments(subcontractor_id, status);
create index idx_sst_conflicts_status_date on public.sst_calendar_conflicts(status, conflict_date);
