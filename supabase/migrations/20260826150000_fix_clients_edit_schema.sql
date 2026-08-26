-- Restore client form persistence for all fields currently written by ClientForm.
-- Idempotent migration.
alter table public.clients
  add column if not exists client_type text,
  add column if not exists emails text[] not null default '{}',
  add column if not exists cr_notes text,
  add column if not exists ceev_enabled boolean not null default false,
  add column if not exists ceev_planning_path text,
  add column if not exists ceev_planning_filename text,
  add column if not exists ceev_planning_updated_at timestamptz,
  add column if not exists report_policy text not null default 'a_confirmer',
  add column if not exists lifecycle_status text not null default 'actif',
  add column if not exists lost_at timestamptz;

alter table public.clients drop constraint if exists clients_client_type_check;
alter table public.clients add constraint clients_client_type_check check (client_type is null or client_type in ('particulier','residence','professionnel'));
alter table public.clients drop constraint if exists clients_report_policy_check;
alter table public.clients add constraint clients_report_policy_check check (report_policy in ('oui','non','a_confirmer'));
alter table public.clients drop constraint if exists clients_lifecycle_status_check;
alter table public.clients add constraint clients_lifecycle_status_check check (lifecycle_status in ('actif','perdu'));

update public.clients
set emails = case when coalesce(array_length(emails,1),0)>0 then emails when email is not null and btrim(email)<>'' then array[email] else '{}'::text[] end
where emails is null or coalesce(array_length(emails,1),0)=0;
