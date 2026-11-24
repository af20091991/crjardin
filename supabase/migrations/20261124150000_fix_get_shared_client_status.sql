-- Correctif : get_shared_client ne retournait aucune intervention, car il filtrait sur status = 'termine'
-- alors que l'application enregistre les comptes rendus terminés avec status = 'terminee'.
-- Rétablit le filtre sur les deux valeurs (idempotent : create or replace).

CREATE OR REPLACE FUNCTION public.get_shared_client(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      from public.interventions i where i.client_id=v_client.id and i.status IN ('termine','terminee')
    ),'[]'::jsonb),
    'free_photos', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'storage_path',p.storage_path,'caption',p.caption,'album_id',p.album_id,'created_at',p.created_at) order by p.created_at desc,p.position) from public.intervention_photos p where p.client_id=v_client.id and p.intervention_id is null),'[]'::jsonb),
    'photo_albums', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'created_at',a.created_at) order by a.created_at desc,a.name) from public.client_photo_albums a where a.client_id=v_client.id),'[]'::jsonb)
  );
  return result;
end;
$function$;
