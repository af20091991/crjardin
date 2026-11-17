-- Indicateur « Vu » : date à laquelle le client a ouvert les messages du gérant.
-- Idempotent. Marqué par la page partagée (lien client) via une fonction SECURITY DEFINER.

ALTER TABLE public.client_messages ADD COLUMN IF NOT EXISTS client_read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_gardener_messages_read(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
BEGIN
  SELECT id INTO v_client FROM public.clients WHERE share_token = p_token AND merged_into_client_id IS NULL;
  IF v_client IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.client_messages
     SET client_read_at = now()
   WHERE client_id = v_client
     AND sender = 'gardener'
     AND client_read_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_gardener_messages_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_gardener_messages_read(text) TO anon, authenticated;
