create table if not exists public.client_premium_work_calendar_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  document_id uuid references public.client_premium_documents(id) on delete set null,
  user_id uuid not null default auth.uid(),
  period_label text not null,
  year integer,
  month integer check (month is null or month between 1 and 12),
  sequence integer not null default 1,
  title text not null,
  details text,
  position integer not null default 0,
  source text not null default 'pdf' check (source in ('pdf','manuel','ia')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_premium_work_calendar_client_idx
  on public.client_premium_work_calendar_items(client_id, year, month, sequence, position);

alter table public.client_premium_work_calendar_items enable row level security;

drop policy if exists "Editors read Premium work calendar" on public.client_premium_work_calendar_items;
drop policy if exists "Editors insert Premium work calendar" on public.client_premium_work_calendar_items;
drop policy if exists "Editors update Premium work calendar" on public.client_premium_work_calendar_items;
drop policy if exists "Editors delete Premium work calendar" on public.client_premium_work_calendar_items;

create policy "Editors read Premium work calendar"
  on public.client_premium_work_calendar_items for select to authenticated
  using (public.is_editor(auth.uid()));

create policy "Editors insert Premium work calendar"
  on public.client_premium_work_calendar_items for insert to authenticated
  with check (user_id = auth.uid() and public.is_editor(auth.uid()));

create policy "Editors update Premium work calendar"
  on public.client_premium_work_calendar_items for update to authenticated
  using (public.is_editor(auth.uid()))
  with check (public.is_editor(auth.uid()));

create policy "Editors delete Premium work calendar"
  on public.client_premium_work_calendar_items for delete to authenticated
  using (public.is_editor(auth.uid()));
