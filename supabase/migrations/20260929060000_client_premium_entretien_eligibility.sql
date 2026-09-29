-- Compte Client Premium : seuls les clients en entretien annuel peuvent avoir Premium actif.
-- Le contrôle est volontairement côté base afin qu'une activation ne puisse pas être contournée
-- par un autre client Supabase ou un appel direct à l'API.

create or replace function public.enforce_client_premium_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_type text;
begin
  if new.enabled then
    select contract_type
      into v_contract_type
      from public.clients
     where id = new.client_id;

    if v_contract_type is distinct from 'Entretien annuel' then
      raise exception 'Premium réservé aux clients ayant souscrit un entretien annuel';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists client_premium_eligibility on public.client_premium;
create trigger client_premium_eligibility
before insert or update of enabled, client_id
on public.client_premium
for each row
execute function public.enforce_client_premium_eligibility();

create or replace function public.prevent_contract_downgrade_with_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contract_type is distinct from 'Entretien annuel'
     and old.contract_type = 'Entretien annuel'
     and exists (
       select 1
         from public.client_premium p
        where p.client_id = new.id
          and p.enabled
     ) then
    raise exception 'Désactivez Premium avant de retirer le contrat Entretien annuel';
  end if;

  return new;
end;
$$;

drop trigger if exists client_contract_premium_guard on public.clients;
create trigger client_contract_premium_guard
before update of contract_type
on public.clients
for each row
execute function public.prevent_contract_downgrade_with_premium();
