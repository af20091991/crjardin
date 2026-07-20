
CREATE OR REPLACE VIEW public.v_client_next_best_offers
WITH (security_invoker = true) AS
WITH freq AS (
  SELECT
    id AS service_id,
    default_frequency,
    CASE
      WHEN default_frequency ILIKE '%hebdo%' THEN 7
      WHEN default_frequency ILIKE '%bimensuel%' OR default_frequency ILIKE '%quinzaine%' OR default_frequency ILIKE '%15 j%' THEN 15
      WHEN default_frequency ILIKE '%mensuel%' THEN 30
      WHEN default_frequency ILIKE '%bimestriel%' OR default_frequency ILIKE '%2 mois%' THEN 60
      WHEN default_frequency ILIKE '%trimestriel%' OR default_frequency ILIKE '%3 mois%' THEN 90
      WHEN default_frequency ILIKE '%semestriel%' OR default_frequency ILIKE '%6 mois%' OR default_frequency ILIKE '%biannuel%' OR default_frequency ILIKE '%2 fois%' THEN 182
      WHEN default_frequency ILIKE '%annuel%' OR default_frequency ILIKE '%1 an%' OR default_frequency ILIKE '%par an%' THEN 365
      ELSE NULL
    END AS expected_days
  FROM public.services
),
season_current AS (
  SELECT service_id
  FROM public.v_service_seasonality_resolved
  WHERE month = EXTRACT(month FROM CURRENT_DATE)::int
    AND COALESCE(intensity, 0) >= 1
  GROUP BY service_id
),
season_months AS (
  SELECT
    service_id,
    array_agg(month ORDER BY month) FILTER (WHERE COALESCE(intensity, 0) >= 1) AS months
  FROM public.v_service_seasonality_resolved
  GROUP BY service_id
),
base AS (
  SELECT
    g.user_id, g.client_id, g.service_id,
    g.service_label AS service_name,
    g.category_id,
    NULL::date AS last_performed_at,
    NULL::int  AS days_since_last_performed,
    TRUE  AS is_gap,
    FALSE AS is_overdue
  FROM public.v_client_service_gaps g
  UNION ALL
  SELECT
    p.user_id, p.client_id, p.service_id,
    p.service_label AS service_name,
    p.category_id,
    p.last_date AS last_performed_at,
    (CURRENT_DATE - p.last_date)::int AS days_since_last_performed,
    FALSE AS is_gap,
    EXISTS (
      SELECT 1 FROM freq f
      WHERE f.service_id = p.service_id
        AND f.expected_days IS NOT NULL
        AND (CURRENT_DATE - p.last_date) > f.expected_days
    ) AS is_overdue
  FROM public.v_client_service_profile p
  WHERE p.last_date IS NOT NULL
)
SELECT
  b.user_id,
  b.client_id,
  b.service_id,
  b.service_name,
  sc.label AS category_name,
  LEAST(
    100,
    (CASE WHEN b.is_gap THEN 40 ELSE 0 END)
    + (CASE WHEN b.is_overdue THEN 30 ELSE 0 END)
    + (CASE WHEN scur.service_id IS NOT NULL THEN 20 ELSE 0 END)
    + (CASE WHEN COALESCE(sm.gross_margin, 0) > 0 THEN 10 ELSE 0 END)
  )::int AS score_opportunity,
  CASE
    WHEN b.is_gap     THEN 'jamais_realise'
    WHEN b.is_overdue THEN 'hors_frequence'
    ELSE                   'rappel_saisonnier'
  END AS reason,
  smo.months AS recommended_season,
  f.default_frequency,
  b.last_performed_at,
  b.days_since_last_performed,
  vcp.price_ht AS estimated_value
FROM base b
LEFT JOIN public.service_categories sc      ON sc.id = b.category_id
LEFT JOIN freq f                            ON f.service_id = b.service_id
LEFT JOIN season_current scur               ON scur.service_id = b.service_id
LEFT JOIN season_months smo                 ON smo.service_id = b.service_id
LEFT JOIN public.v_service_current_price vcp ON vcp.service_id = b.service_id
LEFT JOIN public.v_service_margin sm         ON sm.service_id = b.service_id
WHERE b.is_gap OR b.is_overdue OR scur.service_id IS NOT NULL;

GRANT SELECT ON public.v_client_next_best_offers TO authenticated;
