alter table public.worksite_sheets
  add column if not exists estimated_hours numeric(6,2),
  add column if not exists required_people integer not null default 1,
  add column if not exists planning_status text not null default 'draft';

alter table public.worksite_sheets
  drop constraint if exists worksite_sheets_required_people_check;

alter table public.worksite_sheets
  add constraint worksite_sheets_required_people_check
  check (required_people >= 1);

alter table public.worksite_sheets
  drop constraint if exists worksite_sheets_estimated_hours_check;

alter table public.worksite_sheets
  add constraint worksite_sheets_estimated_hours_check
  check (estimated_hours is null or estimated_hours >= 0);

alter table public.worksite_sheets
  drop constraint if exists worksite_sheets_planning_status_check;

alter table public.worksite_sheets
  add constraint worksite_sheets_planning_status_check
  check (planning_status in ('draft', 'validated'));

create index if not exists worksite_sheets_planning_date_idx
  on public.worksite_sheets (intervention_date, planning_status);
