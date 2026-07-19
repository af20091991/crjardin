
-- PRIORITÉ 1.1 — Intervention ↔ Jardin
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS worksite_sheet_id uuid REFERENCES public.worksite_sheets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_interventions_worksite ON public.interventions(worksite_sheet_id);

-- PRIORITÉ 1.2 — Tâche ↔ Catalogue prestations
ALTER TABLE public.intervention_tasks
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_intervention_tasks_service ON public.intervention_tasks(service_id);

-- PRIORITÉ 1.3 — CA ↔ Intervention
ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_intervention ON public.pilot_ca_entries(intervention_id);

-- PRIORITÉ 2 — Rentabilité intervention
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS hours_spent numeric,
  ADD COLUMN IF NOT EXISTS internal_hourly_rate numeric;

-- PRIORITÉ 4 — Préparation archivage CR
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz;

-- Vue rentabilité par intervention
CREATE OR REPLACE VIEW public.v_intervention_pnl
WITH (security_invoker = true)
AS
WITH ca_direct AS (
  SELECT intervention_id, COALESCE(SUM(amount_ht), 0)::numeric AS ca_direct
  FROM public.pilot_ca_entries
  WHERE kind = 'vente' AND intervention_id IS NOT NULL
  GROUP BY intervention_id
),
sst_agg AS (
  SELECT intervention_id,
    COALESCE(SUM(client_price), 0)::numeric AS sst_client_revenue,
    COALESCE(SUM(COALESCE(invoiced_amount, agreed_price, 0)), 0)::numeric AS sst_cost
  FROM public.subcontractor_missions
  WHERE intervention_id IS NOT NULL
  GROUP BY intervention_id
)
SELECT
  i.id                                                     AS intervention_id,
  i.user_id,
  i.client_id,
  i.intervention_date,
  i.status,
  COALESCE(c.ca_direct, 0)                                 AS ca_direct,
  COALESCE(s.sst_client_revenue, 0)                        AS sst_client_revenue,
  (COALESCE(c.ca_direct, 0) + COALESCE(s.sst_client_revenue, 0))    AS client_revenue,
  COALESCE(s.sst_cost, 0)                                  AS sst_cost,
  (COALESCE(i.hours_spent, 0) * COALESCE(i.internal_hourly_rate, 0))::numeric AS internal_cost,
  ( COALESCE(c.ca_direct, 0) + COALESCE(s.sst_client_revenue, 0)
    - COALESCE(s.sst_cost, 0)
    - (COALESCE(i.hours_spent, 0) * COALESCE(i.internal_hourly_rate, 0)) )::numeric AS gross_margin,
  CASE
    WHEN (COALESCE(c.ca_direct, 0) + COALESCE(s.sst_client_revenue, 0)) > 0
    THEN ROUND(
      ( COALESCE(c.ca_direct, 0) + COALESCE(s.sst_client_revenue, 0)
        - COALESCE(s.sst_cost, 0)
        - (COALESCE(i.hours_spent, 0) * COALESCE(i.internal_hourly_rate, 0)) )
      / (COALESCE(c.ca_direct, 0) + COALESCE(s.sst_client_revenue, 0)) * 100
    , 2)
    ELSE NULL
  END                                                      AS margin_pct
FROM public.interventions i
LEFT JOIN ca_direct  c ON c.intervention_id = i.id
LEFT JOIN sst_agg    s ON s.intervention_id = i.id;

GRANT SELECT ON public.v_intervention_pnl TO authenticated;
