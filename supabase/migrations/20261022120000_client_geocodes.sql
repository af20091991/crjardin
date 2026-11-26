-- Module Mapping : cache des coordonnées géocodées (clients + adresse de référence).
-- cache_key = 'client:<uuid>' ou 'origin'. L'adresse géocodée est conservée pour invalider le cache si elle change.
create table if not exists public.client_geocodes (
  cache_key text primary key,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  formatted_address text,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.client_geocodes to authenticated;
grant all on public.client_geocodes to service_role;
alter table public.client_geocodes enable row level security;

drop policy if exists "Members read client geocodes" on public.client_geocodes;
create policy "Members read client geocodes" on public.client_geocodes
  for select to authenticated using (public.is_approved_member(auth.uid()));

drop policy if exists "Members insert client geocodes" on public.client_geocodes;
create policy "Members insert client geocodes" on public.client_geocodes
  for insert to authenticated with check (public.is_approved_member(auth.uid()));

drop policy if exists "Members update client geocodes" on public.client_geocodes;
create policy "Members update client geocodes" on public.client_geocodes
  for update to authenticated
  using (public.is_approved_member(auth.uid()))
  with check (public.is_approved_member(auth.uid()));
