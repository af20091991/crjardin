ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stamp_data text;

CREATE OR REPLACE FUNCTION public.set_recommendation_interest(p_token text, p_reco_id uuid, p_interest text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients; v_reco public.recommendations;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Lien invalide'; END IF;
  IF p_interest NOT IN ('interested','not_interested','none') THEN RAISE EXCEPTION 'Choix invalide'; END IF;
  SELECT * INTO v_reco FROM public.recommendations WHERE id = p_reco_id AND client_id = v_client.id;
  IF v_reco.id IS NULL THEN RAISE EXCEPTION 'Préconisation introuvable'; END IF;

  IF p_interest = 'none' THEN
    UPDATE public.recommendations
      SET client_interest = NULL, client_interest_at = NULL
    WHERE id = p_reco_id;
    RETURN;
  END IF;

  UPDATE public.recommendations
    SET client_interest = p_interest, client_interest_at = now()
  WHERE id = p_reco_id;

  INSERT INTO public.notifications (user_id, type, title, body, client_id)
  VALUES (v_reco.user_id, 'question',
    v_client.name || (CASE WHEN p_interest = 'interested' THEN ' est intéressé(e) par une préconisation' ELSE ' a décliné une préconisation' END),
    v_reco.title, v_client.id);
END;
$function$;