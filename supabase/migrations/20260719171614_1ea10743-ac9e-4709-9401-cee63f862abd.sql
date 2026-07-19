
ALTER TABLE public.subcontractor_missions
  ADD COLUMN IF NOT EXISTS intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hours_spent numeric,
  ADD COLUMN IF NOT EXISTS internal_rating smallint CHECK (internal_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS context_notes text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS client_price numeric;

CREATE INDEX IF NOT EXISTS idx_sst_missions_intervention ON public.subcontractor_missions(intervention_id);
CREATE INDEX IF NOT EXISTS idx_sst_missions_service ON public.subcontractor_missions(service_id);

ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS default_service_types text[] NOT NULL DEFAULT '{}';

-- Vue P&L mission
CREATE OR REPLACE VIEW public.v_sst_mission_pnl
WITH (security_invoker = true) AS
SELECT
  m.id                                              AS mission_id,
  m.user_id,
  m.subcontractor_id,
  m.client_id,
  m.intervention_id,
  m.mission_date,
  m.status,
  m.agreed_price,
  m.invoiced_amount,
  m.client_price,
  COALESCE(m.invoiced_amount, m.agreed_price, 0)::numeric AS sst_cost,
  COALESCE(m.client_price, 0)::numeric                    AS client_revenue,
  (COALESCE(m.client_price, 0) - COALESCE(m.invoiced_amount, m.agreed_price, 0))::numeric AS gross_margin,
  CASE
    WHEN COALESCE(m.client_price, 0) > 0
      THEN ROUND(((COALESCE(m.client_price,0) - COALESCE(m.invoiced_amount, m.agreed_price, 0)) / m.client_price * 100)::numeric, 1)
    ELSE NULL
  END AS margin_pct
FROM public.subcontractor_missions m;

GRANT SELECT ON public.v_sst_mission_pnl TO authenticated;

-- Vue synthèse par SST
CREATE OR REPLACE VIEW public.v_sst_summary
WITH (security_invoker = true) AS
SELECT
  s.id                                                            AS subcontractor_id,
  s.user_id,
  s.name,
  s.active,
  COUNT(m.id)                                                     AS missions_count,
  COUNT(m.id) FILTER (WHERE m.status IN ('done','done_with_issues')) AS missions_done,
  COALESCE(SUM(COALESCE(m.invoiced_amount, m.agreed_price)), 0)::numeric AS total_sst_cost,
  COALESCE(SUM(m.client_price), 0)::numeric                       AS total_client_revenue,
  COALESCE(SUM(COALESCE(m.client_price,0) - COALESCE(m.invoiced_amount, m.agreed_price, 0)), 0)::numeric AS total_gross_margin,
  ROUND(AVG(m.internal_rating)::numeric, 2)                       AS avg_rating,
  MAX(m.mission_date)                                             AS last_mission_date
FROM public.subcontractors s
LEFT JOIN public.subcontractor_missions m ON m.subcontractor_id = s.id
GROUP BY s.id, s.user_id, s.name, s.active;

GRANT SELECT ON public.v_sst_summary TO authenticated;
