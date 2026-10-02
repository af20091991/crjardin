-- Suivi de consultation des documents transmis aux clients Premium.
alter table public.client_premium_documents
  add column if not exists client_viewed_at timestamptz,
  add column if not exists client_view_count integer not null default 0;
