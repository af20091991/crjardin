create or replace function public.complete_equipment_maintenance(p_schedule_id uuid,p_maintenance_date date,p_cost numeric default null)
returns public.equipment_maintenance language plpgsql security invoker set search_path=public as $$
declare v_schedule public.equipment_maintenance_schedules%rowtype; v_type public.maintenance_types%rowtype; v_history public.equipment_maintenance%rowtype;
begin
 select * into v_schedule from public.equipment_maintenance_schedules where id=p_schedule_id and user_id=auth.uid() for update;
 if not found then raise exception 'Échéance dºw^~)Þuentretien introuvable'; end if;
 select * into v_type from public.maintenance_types where id=v_schedule.maintenance_type_id and user_id=auth.uid();
 if not found then raise exception 'Type k§uçâçYentretien introuvable'; end if;
 insert into public.equipment_maintenance(user_id,equipment_id,maintenance_date,description,cost,next_due_date,maintenance_type_id)
 values(auth.uid(),v_schedule.equipment_id,p_maintenance_date,v_type.name,p_cost,p_maintenance_date+make_interval(months=>v_type.interval_months),v_type.id) returning * into v_history;
 update public.equipment_maintenance_schedules set last_completed_date=p_maintenance_date,next_due_date=p_maintenance_date+make_interval(months=>v_type.interval_months),last_maintenance_id=v_history.id,updated_at=now() where id=p_schedule_id;
 return v_history;
end; $$;
revoke all on function public.complete_equipment_maintenance(uuid,date,numeric) from public;
grant execute on function public.complete_equipment_maintenance(uuid,date,numeric) to authenticated;