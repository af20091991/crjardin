-- 1) Nouvelle colonne : chemin de l'archive PDF réellement envoyée au client
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS sent_pdf_storage_path text;

-- 2) Fonction : trace la consultation du PDF envoyé et retourne son chemin
CREATE OR REPLACE FUNCTION public.record_shared_report_view(
  p_token text,
  p_intervention_id uuid,
  p_user_agent text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_iv public.interventions;
  v_path text;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Lien invalide';
  END IF;

  SELECT * INTO v_iv
  FROM public.interventions
  WHERE id = p_intervention_id AND client_id = v_client.id AND status = 'termine';
  IF v_iv.id IS NULL THEN
    RAISE EXCEPTION 'Compte-rendu introuvable';
  END IF;

  v_path := COALESCE(v_iv.sent_pdf_storage_path, v_iv.pdf_storage_path);
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Aucun PDF disponible';
  END IF;

  INSERT INTO public.share_access_log (client_id, user_agent, ip_address, section)
  VALUES (v_client.id, p_user_agent, p_ip, 'compte-rendu-pdf');

  INSERT INTO public.intervention_report_history
    (intervention_id, user_id, event_type, pdf_storage_path, recipient, metadata)
  VALUES
    (v_iv.id, v_iv.user_id, 'viewed_by_client', v_path, NULL,
     jsonb_build_object('user_agent', p_user_agent, 'ip', p_ip));

  RETURN jsonb_build_object(
    'pdf_storage_path', v_path,
    'sent_pdf_storage_path', v_iv.sent_pdf_storage_path,
    'sent_to_client_at', v_iv.sent_to_client_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_shared_report_view(text, uuid, text, text) TO anon, authenticated;

-- 3) Mise à jour de get_shared_client : expose les infos d'envoi
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
        'sent_to_client_at', i.sent_to_client_at,
        'has_sent_pdf', (i.sent_pdf_storage_path IS NOT NULL),
        'has_pdf', (COALESCE(i.sent_pdf_storage_path, i.pdf_storage_path) IS NOT NULL),
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