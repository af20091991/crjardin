-- Données de l'entreprise réservées à l'administrateur (gérant).
-- Le prestataire ne doit plus lire ni modifier : les fiches Premium (notes commerciales,
-- documents), la qualité des données, ni la veille concurrentielle du site web.
-- Les tables utilisées par les écrans prestataire (clients, interventions, email_settings
-- pour les modèles d'e-mails des CR) ne sont pas modifiées ici.

-- 1) Fiches Premium : administrateur uniquement
DROP POLICY IF EXISTS "Editors read client_premium" ON public.client_premium;
DROP POLICY IF EXISTS "Editors insert client_premium" ON public.client_premium;
DROP POLICY IF EXISTS "Editors update client_premium" ON public.client_premium;
DROP POLICY IF EXISTS "Editors delete client_premium" ON public.client_premium;

CREATE POLICY "Admins read client_premium" ON public.client_premium
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert client_premium" ON public.client_premium
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update client_premium" ON public.client_premium
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete client_premium" ON public.client_premium
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Documents Premium : administrateur uniquement en lecture
DROP POLICY IF EXISTS "Editors read premium documents" ON public.client_premium_documents;
CREATE POLICY "Admins read premium documents" ON public.client_premium_documents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Qualité des données : plus accessible au prestataire
DROP POLICY IF EXISTS quality_checks_read_team ON public.pilot_quality_checks;
CREATE POLICY quality_checks_read_team ON public.pilot_quality_checks
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'observateur'::app_role)
  );

-- 4) Veille concurrentielle du site web : administrateur uniquement
DROP POLICY IF EXISTS "Authenticated users manage competitors" ON public.site_web_competitors;
CREATE POLICY "Admins manage competitors" ON public.site_web_competitors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
