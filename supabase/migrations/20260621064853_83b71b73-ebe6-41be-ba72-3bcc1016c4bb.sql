-- Audit log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  target_user_id uuid,
  target_name text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Helper to record an admin action
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action text, p_target_user_id uuid, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_target_name text;
BEGIN
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT display_name INTO v_target_name FROM public.profiles WHERE id = p_target_user_id;
  INSERT INTO public.admin_audit_log (actor_id, actor_name, action, target_user_id, target_name, details)
  VALUES (auth.uid(), v_actor_name, p_action, p_target_user_id, v_target_name, p_details);
END;
$$;

-- Role change: add logging
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_role NOT IN ('admin','prestataire','observateur') THEN
    RAISE EXCEPTION 'Rôle invalide';
  END IF;
  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle administrateur';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role);
  PERFORM public.log_admin_action('role_change', p_user_id, jsonb_build_object('role', p_role));
END;
$$;

-- Approval / suspension: allow 'suspended', add logging
CREATE OR REPLACE FUNCTION public.set_user_approval(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'pending', 'suspended') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;
  UPDATE public.profiles
  SET approval_status = p_status,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE NULL END
  WHERE id = p_user_id;

  IF p_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (p_user_id, 'read', 'Compte validé',
      'Votre accès à l''application a été validé. Bienvenue !');
  END IF;

  PERFORM public.log_admin_action('approval_' || p_status, p_user_id, NULL);
END;
$$;

-- Account deletion: add logging (capture name before deletion)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = p_user_id;
  PERFORM public.log_admin_action('user_deleted', p_user_id, jsonb_build_object('name', v_name));

  DELETE FROM public.client_messages WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = p_user_id);
  DELETE FROM public.share_access_log WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = p_user_id);
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