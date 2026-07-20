
-- Vue: profil des services réalisés par client
CREATE OR REPLACE VIEW public.v_client_service_profile
WITH (security_invoker = true) AS
SELECT
  i.user_id,
  i.client_id,
  t.service_id,
  s.label AS service_label,
  s.category_id,
  MIN(i.intervention_date) AS first_date,
  MAX(i.intervention_date) AS last_date,
  COUNT(*)::int AS occurrences,
  (
    SELECT t2.intervention_id
    FROM public.intervention_tasks t2
    JOIN public.interventions i2 ON i2.id = t2.intervention_id
    WHERE t2.service_id = t.service_id
      AND i2.client_id = i.client_id
    ORDER BY i2.intervention_date DESC, i2.created_at DESC
    LIMIT 1
  ) AS last_intervention_id
FROM public.intervention_tasks t
JOIN public.interventions i ON i.id = t.intervention_id
JOIN public.services s ON s.id = t.service_id
WHERE t.service_id IS NOT NULL
GROUP BY i.user_id, i.client_id, t.service_id, s.label, s.category_id;

GRANT SELECT ON public.v_client_service_profile TO authenticated;
GRANT SELECT ON public.v_client_service_profile TO service_role;

-- Vue: services jamais réalisés pour chaque client (opportunités)
CREATE OR REPLACE VIEW public.v_client_service_gaps
WITH (security_invoker = true) AS
SELECT
  c.user_id,
  c.id AS client_id,
  s.id AS service_id,
  s.label AS service_label,
  s.category_id
FROM public.clients c
CROSS JOIN public.services s
WHERE s.is_archived = false
  AND s.user_id = c.user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.v_client_service_profile p
    WHERE p.client_id = c.id
      AND p.service_id = s.id
  );

GRANT SELECT ON public.v_client_service_gaps TO authenticated;
GRANT SELECT ON public.v_client_service_gaps TO service_role;
