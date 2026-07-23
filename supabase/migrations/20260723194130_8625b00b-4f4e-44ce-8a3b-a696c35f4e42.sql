
CREATE OR REPLACE VIEW public.v_ca_non_qualifie
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.user_id,
  e.year,
  e.month,
  e.designation,
  e.category::text AS source_category,
  e.fiscal_tag,
  e.amount_ht,
  e.client_id,
  CASE
    WHEN e.client_id IS NULL AND e.category IS NULL THEN 'sans_client_sans_categorie'
    WHEN e.client_id IS NULL THEN 'sans_client'
    WHEN e.category IS NULL THEN 'sans_categorie'
    ELSE 'qualifie'
  END AS qualification_state,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'check_type', q.check_type,
      'severity', q.severity,
      'status', q.status,
      'message', q.message
    ))
    FROM public.pilot_quality_checks q
    WHERE q.target_table = 'pilot_ca_entries' AND q.target_id = e.id AND q.status <> 'resolved'
  ) AS open_checks
FROM public.pilot_ca_entries e
WHERE e.kind = 'vente'
  AND (e.client_id IS NULL OR e.category IS NULL);

GRANT SELECT ON public.v_ca_non_qualifie TO authenticated;
GRANT SELECT ON public.v_ca_non_qualifie TO service_role;
