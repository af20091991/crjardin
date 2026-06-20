ALTER TABLE public.share_access_log ADD COLUMN IF NOT EXISTS ip_address text;

CREATE OR REPLACE FUNCTION public.mark_shared_read(p_token text, p_user_agent text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_iv RECORD;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.share_access_log (client_id, user_agent, ip_address) VALUES (v_client.id, p_user_agent, p_ip);

  FOR v_iv IN
    SELECT id, user_id, title, reference, client_read_count
    FROM public.interventions
    WHERE client_id = v_client.id AND status = 'termine'
  LOOP
    IF v_iv.client_read_count = 0 THEN
      INSERT INTO public.notifications (user_id, type, title, body, client_id, intervention_id)
      VALUES (v_iv.user_id, 'read',
        v_client.name || ' a consulté un compte-rendu',
        COALESCE(v_iv.title, v_iv.reference, 'Compte-rendu') || ' a été lu par le client.',
        v_client.id, v_iv.id);
    END IF;
    UPDATE public.interventions
    SET client_read_at = now(), client_read_count = client_read_count + 1
    WHERE id = v_iv.id;
  END LOOP;
END;
$function$;