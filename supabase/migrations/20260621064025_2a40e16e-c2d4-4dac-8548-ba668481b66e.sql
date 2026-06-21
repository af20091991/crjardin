-- Authorization helper: editors = admins and prestataires
CREATE OR REPLACE FUNCTION public.is_editor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'prestataire')
$$;

-- Migrate existing non-admin accounts to 'prestataire' (preserve current edit ability)
UPDATE public.user_roles SET role = 'prestataire' WHERE role = 'user';

-- New signups default to observateur (read-only) instead of 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := NEW.email = 'fournier.anthony2009@gmail.com';
  v_admin record;
BEGIN
  INSERT INTO public.profiles (id, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_admin THEN now() ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::app_role ELSE 'observateur'::app_role END)
  ON CONFLICT DO NOTHING;

  IF NOT v_is_admin THEN
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (v_admin.user_id, 'question', 'Nouvelle inscription à valider',
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email) || ' demande l''accès à l''application.');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Admin-only role assignment
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
END;
$$;

-- ===== Rewrite write policies to require editor role =====

-- clients
DROP POLICY IF EXISTS "Owner insert clients" ON public.clients;
DROP POLICY IF EXISTS "Owner update clients" ON public.clients;
DROP POLICY IF EXISTS "Owner delete clients" ON public.clients;
CREATE POLICY "Editors insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update clients" ON public.clients FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete clients" ON public.clients FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- interventions
DROP POLICY IF EXISTS "Owner insert interventions" ON public.interventions;
DROP POLICY IF EXISTS "Owner update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Owner delete interventions" ON public.interventions;
CREATE POLICY "Editors insert interventions" ON public.interventions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update interventions" ON public.interventions FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete interventions" ON public.interventions FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- intervention_tasks
DROP POLICY IF EXISTS "Owner insert tasks" ON public.intervention_tasks;
DROP POLICY IF EXISTS "Owner update tasks" ON public.intervention_tasks;
DROP POLICY IF EXISTS "Owner delete tasks" ON public.intervention_tasks;
CREATE POLICY "Editors insert tasks" ON public.intervention_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update tasks" ON public.intervention_tasks FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete tasks" ON public.intervention_tasks FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- intervention_photos
DROP POLICY IF EXISTS "Owner insert photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Owner update photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Owner delete photos" ON public.intervention_photos;
CREATE POLICY "Editors insert photos" ON public.intervention_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update photos" ON public.intervention_photos FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete photos" ON public.intervention_photos FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- garden_health
DROP POLICY IF EXISTS "Owner insert garden health" ON public.garden_health;
DROP POLICY IF EXISTS "Owner update garden health" ON public.garden_health;
DROP POLICY IF EXISTS "Owner delete garden health" ON public.garden_health;
CREATE POLICY "Editors insert garden health" ON public.garden_health FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update garden health" ON public.garden_health FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete garden health" ON public.garden_health FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- recommendations
DROP POLICY IF EXISTS "Owner insert recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Owner update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Owner delete recommendations" ON public.recommendations;
CREATE POLICY "Editors insert recommendations" ON public.recommendations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));
CREATE POLICY "Editors update recommendations" ON public.recommendations FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete recommendations" ON public.recommendations FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- client_messages (prestataire replies)
DROP POLICY IF EXISTS "Owner insert client messages" ON public.client_messages;
DROP POLICY IF EXISTS "Owner or admin update client messages" ON public.client_messages;
DROP POLICY IF EXISTS "Owner or admin delete client messages" ON public.client_messages;
CREATE POLICY "Editors insert client messages" ON public.client_messages FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors update client messages" ON public.client_messages FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors delete client messages" ON public.client_messages FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

-- reminders (personal, editors only)
DROP POLICY IF EXISTS "Owner manage reminders" ON public.reminders;
CREATE POLICY "Editors manage own reminders" ON public.reminders FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_editor(auth.uid())) WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));

-- report_templates (personal, editors only)
DROP POLICY IF EXISTS "Owner manage templates" ON public.report_templates;
CREATE POLICY "Editors manage own templates" ON public.report_templates FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_editor(auth.uid())) WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));

-- favorite_tasks (personal, editors only)
DROP POLICY IF EXISTS "Users manage own favorite tasks" ON public.favorite_tasks;
CREATE POLICY "Editors manage own favorite tasks" ON public.favorite_tasks FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_editor(auth.uid())) WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));