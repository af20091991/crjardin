create or replace function public.is_linked_to_subcontractor(_user_id uuid, _subcontractor_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.sst_user_links l
    where l.user_id = _user_id
      and l.subcontractor_id = _subcontractor_id
      and l.active = true
  )
$$;

create or replace function public.enforce_sst_target_response_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.request_id is distinct from old.request_id
    or new.subcontractor_id is distinct from old.subcontractor_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée';
  end if;

  if new.status not in ('pending', 'answered') then
    raise exception 'Statut non autorisé';
  end if;

  new.updated_at = now();
  if new.status = 'answered' and old.status is distinct from 'answered' then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.enforce_sst_assignment_response_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.intervention_id is distinct from old.intervention_id
    or new.mission_id is distinct from old.mission_id
    or new.subcontractor_id is distinct from old.subcontractor_id
    or new.required_people is distinct from old.required_people
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.planning_comment is distinct from old.planning_comment
    or new.proposed_at is distinct from old.proposed_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée';
  end if;

  if new.status not in ('confirmed', 'refused', 'verify', 'to_confirm') then
    raise exception 'Statut non autorisé';
  end if;

  new.updated_at = now();
  if new.status is distinct from old.status then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_sst_target_response_update() from public, anon, authenticated;
revoke execute on function public.enforce_sst_assignment_response_update() from public, anon, authenticated;
