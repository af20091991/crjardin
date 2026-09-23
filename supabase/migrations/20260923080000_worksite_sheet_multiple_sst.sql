-- Fiches SST : plusieurs sous-traitants peuvent être affectés à une même fiche chantier.
CREATE TABLE public.worksite_sheet_subcontractors (
  worksite_sheet_id uuid NOT NULL REFERENCES public.worksite_sheets(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worksite_sheet_id, subcontractor_id)
);

CREATE INDEX idx_worksite_sheet_subcontractors_sheet
  ON public.worksite_sheet_subcontractors(worksite_sheet_id);

CREATE INDEX idx_worksite_sheet_subcontractors_sst
  ON public.worksite_sheet_subcontractors(subcontractor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksite_sheet_subcontractors TO authenticated;
GRANT ALL ON public.worksite_sheet_subcontractors TO service_role;

ALTER TABLE public.worksite_sheet_subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors read own or admin reads all worksite sheet SST"
ON public.worksite_sheet_subcontractors FOR SELECT TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Editors insert own worksite sheet SST"
ON public.worksite_sheet_subcontractors FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND public.is_editor(auth.uid())
);

CREATE POLICY "Editors update own or admin updates all worksite sheet SST"
ON public.worksite_sheet_subcontractors FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Editors delete own or admin deletes all worksite sheet SST"
ON public.worksite_sheet_subcontractors FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);
