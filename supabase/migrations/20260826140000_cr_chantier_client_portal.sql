-- CR Chantier: client notes and optional CEEV planning PDF.
-- The PDF is stored in a private bucket and is only exposed through signed URLs.
alter table public.clients
  add column if not exists cr_notes text,
  add column if not exists ceev_enabled boolean not null default false,
  add column if not exists ceev_planning_path text,
  add column if not exists ceev_planning_filename text,
  add column if not exists ceev_planning_updated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('client-plannings', 'client-plannings', false)
on conflict (id) do update set public = false;

-- Access is deliberately handled by server-side signed URLs; no public read policy.
