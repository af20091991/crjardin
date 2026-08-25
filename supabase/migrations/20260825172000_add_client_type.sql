-- Pilot Pro: classification simple du client.
-- Un client est soit un particulier, soit une résidence, soit un professionnel.
-- Le référent présent sur place n'est pas un type de client et reste hors de
-- cette classification.
alter table public.clients
  add column if not exists client_type text;

alter table public.clients
  drop constraint if exists clients_client_type_check;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type is null or client_type in ('particulier', 'residence', 'professionnel'));

create index if not exists clients_client_type_idx
  on public.clients (client_type);
