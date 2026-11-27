-- Rappels d'intervention Premium : date/heure planifiées et délais de rappel par intervention.
-- Table de journal pour n'envoyer (notifier) qu'une seule fois chaque rappel.

alter table public.client_premium_work_calendar_items
  add column if not exists scheduled_at timestamptz,
  add column if not exists reminder_hours integer[] not null default '{48}';

alter table public.client_premium_work_calendar_items
  drop constraint if exists client_premium_work_calendar_reminder_hours_check;
alter table public.client_premium_work_calendar_items
  add constraint client_premium_work_calendar_reminder_hours_check
  check (reminder_hours <@ array[12, 24, 48]::integer[]);

create table if not exists public.client_premium_reminder_log (
  item_id uuid not null references public.client_premium_work_calendar_items(id) on delete cascade,
  reminder_hours integer not null check (reminder_hours in (12, 24, 48)),
  notified_at timestamptz not null default now(),
  primary key (item_id, reminder_hours)
);

grant select, insert, delete on public.client_premium_reminder_log to service_role;
alter table public.client_premium_reminder_log enable row level security;
