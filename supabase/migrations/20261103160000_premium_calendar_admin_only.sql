-- Calendrier de travaux Premium : réservé à l'administrateur (masqué pour les prestataires).
DROP POLICY IF EXISTS "Editors read Premium work calendar" ON public.client_premium_work_calendar_items;
DROP POLICY IF EXISTS "Editors insert Premium work calendar" ON public.client_premium_work_calendar_items;
DROP POLICY IF EXISTS "Editors update Premium work calendar" ON public.client_premium_work_calendar_items;
DROP POLICY IF EXISTS "Editors delete Premium work calendar" ON public.client_premium_work_calendar_items;

CREATE POLICY "Admins read Premium work calendar" ON public.client_premium_work_calendar_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert Premium work calendar" ON public.client_premium_work_calendar_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update Premium work calendar" ON public.client_premium_work_calendar_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete Premium work calendar" ON public.client_premium_work_calendar_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
