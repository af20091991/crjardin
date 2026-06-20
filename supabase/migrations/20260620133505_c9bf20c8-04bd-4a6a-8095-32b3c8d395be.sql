CREATE OR REPLACE FUNCTION public.get_shared_client(p_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients; result jsonb;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN NULL; END IF;
  result := jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id, 'name', v_client.name, 'civility', v_client.civility, 'address', v_client.address,
      'phone', v_client.phone, 'email', v_client.email,
      'contract_type', v_client.contract_type, 'frequency', v_client.frequency
    ),
    'recommendations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'description', r.description, 'category', r.category,
        'status', r.status, 'estimated_hours', r.estimated_hours, 'unit_price', r.unit_price,
        'client_interest', r.client_interest
      ) ORDER BY r.created_at DESC)
      FROM public.recommendations r
      WHERE r.client_id = v_client.id AND r.status IN ('en_attente','acceptee')
    ), '[]'::jsonb),
    'interventions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'reference', i.reference,
        'intervention_date', i.intervention_date, 'intervention_type', i.intervention_type,
        'summary', i.summary, 'garden_state', i.garden_state, 'upcoming_works', i.upcoming_works,
        'recommendations_text', i.recommendations_text, 'client_read_at', i.client_read_at,
        'tasks', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'status', t.status, 'note', t.note) ORDER BY t.position)
          FROM public.intervention_tasks t WHERE t.intervention_id = i.id
        ), '[]'::jsonb),
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', p.id, 'storage_path', p.storage_path, 'caption', p.caption) ORDER BY p.position)
          FROM public.intervention_photos p WHERE p.intervention_id = i.id AND p.include_in_report = true
        ), '[]'::jsonb)
      ) ORDER BY i.intervention_date DESC)
      FROM public.interventions i
      WHERE i.client_id = v_client.id AND i.status = 'termine'
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$function$;