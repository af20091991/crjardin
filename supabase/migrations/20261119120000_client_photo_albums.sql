-- Albums de photos libres et classement chronologique.
create table if not exists public.client_photo_albums (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.intervention_photos
  add column if not exists album_id uuid references public.client_photo_albums(id) on delete set null;
create index if not exists client_photo_albums_client_created_idx on public.client_photo_albums(client_id, created_at desc);
create index if not exists intervention_photos_album_created_idx on public.intervention_photos(album_id, created_at desc) where album_id is not null;
alter table public.client_photo_albums enable row level security;
grant select, insert, update, delete on public.client_photo_albums to authenticated;
grant all on public.client_photo_albums to service_role;
drop policy if exists "Authenticated read photo albums" on public.client_photo_albums;
create policy "Authenticated read photo albums" on public.client_photo_albums for select to authenticated using (true);
drop policy if exists "Owner insert photo albums" on public.client_photo_albums;
create policy "Owner insert photo albums" on public.client_photo_albums for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Owner update photo albums" on public.client_photo_albums;
create policy "Owner update photo albums" on public.client_photo_albums for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Owner delete photo albums" on public.client_photo_albums;
create policy "Owner delete photo albums" on public.client_photo_albums for delete to authenticated using ((select auth.uid()) = user_id);

-- Regroupe les anciennes photos libres dans un album d'archive par client.
with legacy as (
  select p.client_id, p.user_id, min(p.created_at) first_photo
  from public.intervention_photos p
  where p.intervention_id is null and p.client_id is not null and p.album_id is null
  group by p.client_id, p.user_id
), inserted as (
  insert into public.client_photo_albums(client_id,user_id,name,created_at)
  select client_id,user_id,'Photos importées avant classement',first_photo from legacy
  returning id,client_id
)
update public.intervention_photos p set album_id=a.id
from inserted a
where p.client_id=a.client_id and p.intervention_id is null and p.album_id is null;

create or replace function public.get_shared_client(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_client public.clients; result jsonb;
begin
  select * into v_client from public.clients where share_token=p_token;
  if v_client.id is null then return null; end if;
  result := jsonb_build_object(
    'client', jsonb_build_object('id',v_client.id,'name',v_client.name,'civility',v_client.civility,'address',v_client.address,'phone',v_client.phone,'email',v_client.email,'contract_type',v_client.contract_type,'frequency',v_client.frequency),
    'recommendations', coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'description',r.description,'category',r.category,'status',r.status,'estimated_hours',r.estimated_hours,'unit_price',r.unit_price,'client_interest',r.client_interest,'client_viewed_at',r.client_viewed_at) order by r.created_at desc)
      from public.recommendations r where r.client_id=v_client.id and r.status in ('en_attente','acceptee')
    ),'[]'::jsonb),
    'interventions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'title',i.title,'reference',i.reference,'intervention_date',i.intervention_date,'intervention_type',i.intervention_type,'summary',i.summary,'garden_state',i.garden_state,'upcoming_works',i.upcoming_works,'recommendations_text',i.recommendations_text,'client_read_at',i.client_read_at,'sent_to_client_at',i.sent_to_client_at,'has_sent_pdf',(i.sent_pdf_storage_path is not null),'has_pdf',(coalesce(i.sent_pdf_storage_path,i.pdf_storage_path) is not null),
        'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'status',t.status,'note',t.note) order by t.position) from public.intervention_tasks t where t.intervention_id=i.id),'[]'::jsonb),
        'photos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'storage_path',p.storage_path,'caption',p.caption) order by p.position) from public.intervention_photos p where p.intervention_id=i.id and p.include_in_report=true),'[]'::jsonb)
      ) order by i.intervention_date desc)
      from public.interventions i where i.client_id=v_client.id and i.status='termine'
    ),'[]'::jsonb),
    'free_photos', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'storage_path',p.storage_path,'caption',p.caption,'album_id',p.album_id,'created_at',p.created_at) order by p.created_at desc,p.position) from public.intervention_photos p where p.client_id=v_client.id and p.intervention_id is null),'[]'::jsonb),
    'photo_albums', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'created_at',a.created_at) order by a.created_at desc,a.name) from public.client_photo_albums a where a.client_id=v_client.id),'[]'::jsonb)
  );
  return result;
end;
$function$;
grant execute on function public.get_shared_client(text) to anon,authenticated;
