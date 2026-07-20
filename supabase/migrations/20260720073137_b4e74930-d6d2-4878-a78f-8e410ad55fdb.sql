
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pilot_ca_entry_id uuid REFERENCES public.pilot_ca_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refusal_reason text;

CREATE INDEX IF NOT EXISTS idx_recommendations_planned_intervention ON public.recommendations(planned_intervention_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_pilot_ca_entry ON public.recommendations(pilot_ca_entry_id);

CREATE OR REPLACE VIEW public.v_recommendations_funnel
WITH (security_invoker = true) AS
SELECT
  user_id,
  COUNT(*)::int AS proposees,
  COUNT(*) FILTER (WHERE client_viewed_at IS NOT NULL)::int AS consultees,
  COUNT(*) FILTER (WHERE status IN ('acceptee','planifiee','realisee','facturee'))::int AS acceptees,
  COUNT(*) FILTER (WHERE status IN ('planifiee','realisee','facturee') OR planned_intervention_id IS NOT NULL)::int AS planifiees,
  COUNT(*) FILTER (WHERE status IN ('realisee','facturee'))::int AS realisees,
  COUNT(*) FILTER (WHERE status = 'facturee' OR pilot_ca_entry_id IS NOT NULL)::int AS facturees,
  COUNT(*) FILTER (WHERE status = 'refusee')::int AS refusees,
  COUNT(*) FILTER (WHERE status = 'expiree')::int AS expirees
FROM public.recommendations
GROUP BY user_id;

GRANT SELECT ON public.v_recommendations_funnel TO authenticated;
