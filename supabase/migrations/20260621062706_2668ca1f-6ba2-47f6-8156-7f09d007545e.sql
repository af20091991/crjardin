CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  -- Tables only linked through the user's clients
  DELETE FROM public.client_messages WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = p_user_id);
  DELETE FROM public.share_access_log WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = p_user_id);

  -- Tables carrying user_id directly
  DELETE FROM public.intervention_photos WHERE user_id = p_user_id;
  DELETE FROM public.intervention_tasks WHERE user_id = p_user_id;
  DELETE FROM public.garden_health WHERE user_id = p_user_id;
  DELETE FROM public.recommendations WHERE user_id = p_user_id;
  DELETE FROM public.reminders WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.favorite_tasks WHERE user_id = p_user_id;
  DELETE FROM public.report_templates WHERE user_id = p_user_id;
  DELETE FROM public.intervention_counters WHERE user_id = p_user_id;
  DELETE FROM public.login_events WHERE user_id = p_user_id;
  DELETE FROM public.interventions WHERE user_id = p_user_id;
  DELETE FROM public.clients WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;