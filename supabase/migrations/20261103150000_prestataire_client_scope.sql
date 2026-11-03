-- Prestataire : accès aux données clients limité aux clients qui lui ont été affectés
-- (mission SST ou fiche SST). Le gérant et les observateurs ne sont pas concernés.

-- 1) Clients affectés à un prestataire (compte relié via subcontractors.auth_user_id)
CREATE OR REPLACE FUNCTION public.prestataire_client_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.client_id
  FROM public.subcontractor_missions m
  JOIN public.subcontractors s ON s.id = m.subcontractor_id
  WHERE s.auth_user_id = _user_id AND s.active = true AND m.client_id IS NOT NULL
  UNION
  SELECT w.client_id
  FROM public.worksite_sheets w
  JOIN public.subcontractors s ON s.auth_user_id = _user_id AND s.active = true
  WHERE w.client_id IS NOT NULL
    AND (w.intervenant = s.name OR w.intervenant LIKE '%"' || s.name || '"%')
$$;
GRANT EXECUTE ON FUNCTION public.prestataire_client_ids(uuid) TO authenticated;

-- 2) CR Chantier : lecture, modification et suppression selon le périmètre
DROP POLICY IF EXISTS "Authenticated read all interventions" ON public.interventions;
CREATE POLICY "Read interventions in scope" ON public.interventions
  FOR SELECT TO authenticated USING (
    NOT public.has_role(auth.uid(), 'prestataire'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'observateur'::app_role)
    OR user_id = auth.uid()
    OR client_id IN (SELECT public.prestataire_client_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Editors update interventions" ON public.interventions;
CREATE POLICY "Editors update interventions in scope" ON public.interventions
  FOR UPDATE TO authenticated
  USING (
    public.is_editor(auth.uid()) AND (
      NOT public.has_role(auth.uid(), 'prestataire'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR user_id = auth.uid()
      OR client_id IN (SELECT public.prestataire_client_ids(auth.uid()))
    )
  )
  WITH CHECK (public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "Editors delete interventions" ON public.interventions;
CREATE POLICY "Editors delete interventions in scope" ON public.interventions
  FOR DELETE TO authenticated
  USING (
    public.is_editor(auth.uid()) AND (
      NOT public.has_role(auth.uid(), 'prestataire'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR user_id = auth.uid()
      OR client_id IN (SELECT public.prestataire_client_ids(auth.uid()))
    )
  );

-- 3) Photos de CR : même périmètre
DROP POLICY IF EXISTS "Approved team can read intervention photos" ON public.intervention_photos;
CREATE POLICY "Team reads intervention photos in scope" ON public.intervention_photos
  FOR SELECT TO authenticated USING (
    public.is_approved_member(auth.uid()) AND (
      NOT public.has_role(auth.uid(), 'prestataire'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'observateur'::app_role)
      OR user_id = auth.uid()
      OR client_id IN (SELECT public.prestataire_client_ids(auth.uid()))
      OR intervention_id IN (SELECT id FROM public.interventions)
    )
  );

-- 4) Premium : écritures documents réservées à l'administrateur
DROP POLICY IF EXISTS "Editors insert premium documents" ON public.client_premium_documents;
DROP POLICY IF EXISTS "Editors update premium documents" ON public.client_premium_documents;
DROP POLICY IF EXISTS "Editors delete premium documents" ON public.client_premium_documents;
CREATE POLICY "Admins insert premium documents" ON public.client_premium_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update premium documents" ON public.client_premium_documents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete premium documents" ON public.client_premium_documents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
