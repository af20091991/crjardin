-- Étape 2 : les politiques lisent les prestataires liés (subcontractor_extra_links)
-- en plus de subcontractors.auth_user_id. Pour un utilisateur sans liaison
-- supplémentaire, l'ensemble des lignes visibles est strictement identique.

CREATE OR REPLACE FUNCTION public.prestataire_client_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.client_id
  FROM public.subcontractor_missions m
  JOIN public.subcontractors s ON s.id = m.subcontractor_id
  WHERE s.id IN (SELECT public.auth_subcontractor_ids(_user_id)) AND s.active = true AND m.client_id IS NOT NULL
  UNION
  SELECT w.client_id
  FROM public.worksite_sheets w
  JOIN public.subcontractors s ON s.id IN (SELECT public.auth_subcontractor_ids(_user_id)) AND s.active = true
  WHERE w.client_id IS NOT NULL
    AND (w.intervenant = s.name OR w.intervenant LIKE '%"' || s.name || '"%')
$$;

ALTER POLICY "Assigned subcontractors read own profile" ON public.subcontractors
  USING (id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND active = true);

ALTER POLICY "Active subcontractors read SST availability" ON public.sst_availability_calendar
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
    )
  );

ALTER POLICY "Members read all sst calendar changes" ON public.sst_calendar_changes
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
    )
  );

ALTER POLICY "Assigned subcontractors read own mission photos" ON public.subcontractor_mission_photos
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.id = subcontractor_mission_photos.mission_id
        AND s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
    )
  );

ALTER POLICY "Assigned subcontractors read own missions" ON public.subcontractor_missions
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id = subcontractor_missions.subcontractor_id
        AND s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
    )
  );

ALTER POLICY "Assigned subcontractors read linked worksite sheets" ON public.worksite_sheets
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.worksite_sheet_id = worksite_sheets.id
        AND s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
    )
  );

ALTER POLICY "Assigned subcontractors read sheets by intervenant" ON public.worksite_sheets
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id IN (SELECT public.auth_subcontractor_ids(auth.uid())) AND s.active = true
        AND (worksite_sheets.intervenant = s.name OR worksite_sheets.intervenant ~~ ('%"' || s.name || '"%'))
    )
  );
