CREATE OR REPLACE FUNCTION public.clear_share_access_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  DELETE FROM public.share_access_log;
END;
$$;