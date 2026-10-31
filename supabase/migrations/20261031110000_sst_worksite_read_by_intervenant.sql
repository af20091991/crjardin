-- Fiches SST : un prestataire relié à son compte (subcontractors.auth_user_id)
-- peut lire les fiches dont le champ intervenant (JSON array de noms, ou ancien texte)
-- contient son nom de sous-traitant. Lecture seule ; aucune écriture modifiée.

DROP POLICY IF EXISTS "Assigned subcontractors read sheets by intervenant" ON public.worksite_sheets;
CREATE POLICY "Assigned subcontractors read sheets by intervenant"
  ON public.worksite_sheets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractors s
      WHERE s.auth_user_id = auth.uid()
        AND s.active = true
        AND (
          worksite_sheets.intervenant = s.name
          OR worksite_sheets.intervenant LIKE '%"' || s.name || '"%'
        )
    )
  );
