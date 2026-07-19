
-- 1. Recommendations enrichment
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS recommended_season text;

-- 2. Interventions: report generated timestamp
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS report_generated_at timestamptz;

-- 3. Report history (append-only)
CREATE TABLE IF NOT EXISTS public.intervention_report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('generated','sent','downloaded','regenerated','viewed_by_client')),
  pdf_storage_path text,
  recipient text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_history_intervention
  ON public.intervention_report_history(intervention_id, created_at DESC);

GRANT SELECT, INSERT ON public.intervention_report_history TO authenticated;
GRANT ALL ON public.intervention_report_history TO service_role;

ALTER TABLE public.intervention_report_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read report history"
  ON public.intervention_report_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Editors insert report history"
  ON public.intervention_report_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));

-- 4. Storage policies for intervention-reports bucket
CREATE POLICY "Authenticated read intervention reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'intervention-reports');

CREATE POLICY "Authenticated upload intervention reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'intervention-reports' AND owner = auth.uid());
