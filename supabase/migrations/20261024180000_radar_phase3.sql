-- Radar Visibilité locale, phase 3 : suivi (instantanés, alertes, rapport mensuel) + origine client.
alter table public.clients add column if not exists acquisition_source text;
comment on column public.clients.acquisition_source is 'Réponse à « Comment nous avez-vous connus ? » (saisie manuelle)';

create table if not exists public.radar_snapshots (
  taken_on date primary key,
  opportunities jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.radar_alerts (
  opportunity_key text primary key,
  score numeric not null,
  alerted_at timestamptz not null default now()
);
create table if not exists public.radar_reports (
  month text primary key,
  sent_at timestamptz not null default now()
);

alter table public.radar_snapshots enable row level security;
alter table public.radar_alerts enable row level security;
alter table public.radar_reports enable row level security;

create policy "Admins lisent les instantanés du radar" on public.radar_snapshots for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins lisent les alertes du radar" on public.radar_alerts for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins lisent les rapports du radar" on public.radar_reports for select using (public.has_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
