ALTER TABLE public.ceev_agreements
  ADD COLUMN IF NOT EXISTS visits_planned integer,
  ADD COLUMN IF NOT EXISTS visit_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS season_start_month integer,
  ADD COLUMN IF NOT EXISTS season_end_month integer;

ALTER TABLE public.ceev_agreements
  ADD CONSTRAINT ceev_agreements_visits_planned_check
    CHECK (visits_planned IS NULL OR (visits_planned >= 0 AND visits_planned <= 365)),
  ADD CONSTRAINT ceev_agreements_visit_duration_check
    CHECK (visit_duration_hours IS NULL OR (visit_duration_hours >= 0 AND visit_duration_hours <= 24)),
  ADD CONSTRAINT ceev_agreements_season_start_check
    CHECK (season_start_month IS NULL OR (season_start_month BETWEEN 1 AND 12)),
  ADD CONSTRAINT ceev_agreements_season_end_check
    CHECK (season_end_month IS NULL OR (season_end_month BETWEEN 1 AND 12));

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS ceev_agreement_id uuid
    REFERENCES public.ceev_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS interventions_ceev_agreement_idx
  ON public.interventions(ceev_agreement_id);