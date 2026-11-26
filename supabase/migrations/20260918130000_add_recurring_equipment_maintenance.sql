-- Recurring equipment maintenance rules and schedules
create table if not exists public.equipment_types (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name));
create table if not exists public.maintenance_types (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, interval_months integer not null check(interval_months>0), reminder_days integer not null default 14 check(reminder_days>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name));
create table if not exists public.equipment_type_maintenance_types (equipment_type_id uuid not null references public.equipment_types(id) on delete cascade, maintenance_type_id uuid not null references public.maintenance_types(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(equipment_type_id,maintenance_type_id));
alter table public.equipment add column if not exists equipment_type_id uuid references public.equipment_types(id) on delete set null;
alter table public.equipment_maintenance add column if not exists maintenance_type_id uuid references public.maintenance_types(id) on delete set null;
create table if not exists public.equipment_maintenance_schedules (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, equipment_id uuid not null references public.equipment(id) on delete cascade, maintenance_type_id uuid not null references public.maintenance_types(id) on delete cascade, last_completed_date date, next_due_date date not null, last_maintenance_id uuid references public.equipment_maintenance(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(equipment_id,maintenance_type_id));
create index if not exists equipment_maintenance_schedules_user_due_idx on public.equipment_maintenance_schedules(user_id,next_due_date);
alter table public.equipment_types enable row level security;
alter table public.maintenance_types enable row level security;
alter table public.equipment_type_maintenance_types enable row level security;
alter table public.equipment_maintenance_schedules enable row level security;
drop policy if exists equipment_types_owner_all on public.equipment_types;
create policy equipment_types_owner_all on public.equipment_types for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists maintenance_types_owner_all on public.maintenance_types;
create policy maintenance_types_owner_all on public.maintenance_types for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists equipment_type_maintenance_types_owner_all on public.equipment_type_maintenance_types;
create policy equipment_type_maintenance_types_owner_all on public.equipment_type_maintenance_types for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists equipment_maintenance_schedules_owner_all on public.equipment_maintenance_schedules;
create policy equipment_maintenance_schedules_owner_all on public.equipment_maintenance_schedules for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create or replace function public.sync_equipment_maintenance_schedules(p_equipment_id uuid) returns void language plpgsql security invoker set search_path=public as $$
declare v_equipment public.equipment%rowtype;
begin
 select * into v_equipment from public.equipment where id=p_equipment_id and user_id=auth.uid();
 if not found then raise exception 'Équipement introuvable'; end if;
 insert into public.equipment_maintenance_schedules(user_id,equipment_id,maintenance_type_id,next_due_date)
 select v_equipment.user_id,v_equipment.id,mt.id,current_date+make_interval(months=>mt.interval_months)
 from public.maintenance_types mt join public.equipment_type_maintenance_types etm on etm.maintenance_type_id=mt.id and etm.user_id=mt.user_id
 where mt.user_id=v_equipment.user_id and etm.equipment_type_id=v_equipment.equipment_type_id
 on conflict(equipment_id,maintenance_type_id) do nothing;
 delete from public.equipment_maintenance_schedules s where s.equipment_id=v_equipment.id and s.user_id=v_equipment.user_id
 and not exists(select 1 from public.equipment_type_maintenance_types etm where etm.equipment_type_id=v_equipment.equipment_type_id and etm.maintenance_type_id=s.maintenance_type_id and etm.user_id=s.user_id);
end; $$;
revoke all on function public.sync_equipment_maintenance_schedules(uuid) from public;
grant execute on function public.sync_equipment_maintenance_schedules(uuid) to authenticated;