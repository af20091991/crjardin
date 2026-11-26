-- Journal des modifications de la fiche client (qui, quand, quoi). Idempotent.
-- Les valeurs du lien client ne sont jamais journalisées : seul le fait qu'il a été régénéré l'est.

create table if not exists public.client_change_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  changes jsonb not null
);

create index if not exists client_change_log_client_idx
  on public.client_change_log (client_id, changed_at desc);

alter table public.client_change_log enable row level security;

grant select on public.client_change_log to authenticated;

drop policy if exists "admins lisent le journal client" on public.client_change_log;
create policy "admins lisent le journal client"
  on public.client_change_log
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.log_client_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  foreach v_key in array array[
    'name', 'civility', 'email', 'emails', 'phone', 'address', 'contract_type',
    'client_type', 'frequency', 'notes', 'lifecycle_status', 'report_policy'
  ] loop
    if (v_old -> v_key) is distinct from (v_new -> v_key) then
      v_changes := v_changes || jsonb_build_object(
        v_key, jsonb_build_object('avant', v_old -> v_key, 'après', v_new -> v_key)
      );
    end if;
  end loop;
  if old.share_token is distinct from new.share_token then
    v_changes := v_changes || jsonb_build_object('lien_client', 'régénéré');
  end if;
  if v_changes <> '{}'::jsonb then
    insert into public.client_change_log (client_id, changed_by, changes)
    values (new.id, auth.uid(), v_changes);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_log_client_changes on public.clients;
create trigger trg_log_client_changes
  after update on public.clients
  for each row execute function public.log_client_changes();
