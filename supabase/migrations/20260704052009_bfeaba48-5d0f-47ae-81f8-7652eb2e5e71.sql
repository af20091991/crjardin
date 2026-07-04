ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS client_viewed_at timestamptz;
ALTER TABLE public.share_access_log ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'fiche';

-- get_shared_client : ajoute client_viewed_at aux préconisations renvoyées
CREATE OR REPLACE FUNCTION public.get_shared_client(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
        'client_interest', r.client_interest, 'client_viewed_at', r.client_viewed_at
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

-- Enregistre une visite de l'onglet Préconisations et marque les préconisations comme consultées
CREATE OR REPLACE FUNCTION public.mark_recommendations_viewed(p_token text, p_user_agent text DEFAULT NULL, p_ip text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_newly int;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.share_access_log (client_id, user_agent, ip_address, section)
  VALUES (v_client.id, p_user_agent, p_ip, 'preconisations');

  WITH upd AS (
    UPDATE public.recommendations
    SET client_viewed_at = now()
    WHERE client_id = v_client.id
      AND status IN ('en_attente','acceptee')
      AND client_viewed_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_newly FROM upd;

  IF v_newly > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, body, client_id)
    VALUES (v_client.user_id, 'read',
      v_client.name || ' a consulté ses préconisations',
      v_client.name || ' vient de consulter l''onglet Préconisations (' || v_newly || ' nouvelle(s)).',
      v_client.id);
  END IF;
END;
$function$;