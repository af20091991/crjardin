
CREATE OR REPLACE FUNCTION public.pilot_normalize_designation(t text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT trim(regexp_replace(
    lower(extensions.unaccent(coalesce(t, ''))),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

CREATE OR REPLACE VIEW public.v_ca_match_rules AS
WITH decisions AS (
  SELECT
    public.pilot_normalize_designation(e.designation) AS key,
    e.designation AS sample_designation,
    l.new_client_id,
    l.decided_at
  FROM public.pilot_ca_match_log l
  JOIN public.pilot_ca_entries e ON e.id = l.entry_id
  WHERE l.new_client_id IS NOT NULL
    AND l.method <> 'reverted'
    AND e.designation IS NOT NULL
),
counts AS (
  SELECT key, new_client_id, COUNT(*)::int AS votes,
         MAX(decided_at) AS last_seen,
         (array_agg(sample_designation ORDER BY decided_at DESC))[1] AS sample_designation
  FROM decisions
  GROUP BY key, new_client_id
),
totals AS (
  SELECT key, SUM(votes)::int AS total_votes FROM counts GROUP BY key
),
ranked AS (
  SELECT c.key, c.new_client_id, c.votes, c.last_seen, c.sample_designation,
         t.total_votes,
         ROW_NUMBER() OVER (PARTITION BY c.key ORDER BY c.votes DESC, c.last_seen DESC) AS rn
  FROM counts c JOIN totals t USING (key)
)
SELECT
  r.key AS normalized_designation,
  r.sample_designation,
  r.new_client_id AS client_id,
  cl.name AS client_name,
  r.votes,
  r.total_votes,
  ROUND((r.votes::numeric / NULLIF(r.total_votes,0)) * 100, 1) AS confidence_pct,
  r.last_seen
FROM ranked r
LEFT JOIN public.clients cl ON cl.id = r.new_client_id
WHERE r.rn = 1;

CREATE OR REPLACE VIEW public.v_ca_orphans_report AS
WITH orphans AS (
  SELECT
    e.designation,
    COALESCE(e.raw_designation, e.designation) AS raw_designation,
    public.pilot_normalize_designation(e.designation) AS key,
    e.amount_ht,
    e.id
  FROM public.pilot_ca_entries e
  WHERE e.kind = 'vente' AND e.client_id IS NULL
),
grouped AS (
  SELECT
    designation,
    MAX(raw_designation) AS raw_designation,
    key,
    COUNT(*)::int AS occurrences,
    SUM(amount_ht) AS ca_ht,
    array_agg(id) AS entry_ids
  FROM orphans
  GROUP BY designation, key
),
scored AS (
  SELECT
    g.key,
    cl.id AS client_id,
    cl.name AS client_name,
    GREATEST(
      extensions.similarity(g.key, public.pilot_normalize_designation(cl.name)),
      CASE WHEN public.pilot_normalize_designation(cl.name) LIKE '%' || g.key || '%'
             OR g.key LIKE '%' || public.pilot_normalize_designation(cl.name) || '%'
           THEN 0.6 ELSE 0 END
    ) AS score
  FROM grouped g
  CROSS JOIN public.clients cl
),
best_client AS (
  SELECT key, client_id, client_name, score FROM (
    SELECT s.*, ROW_NUMBER() OVER (PARTITION BY key ORDER BY score DESC) AS rn FROM scored s
  ) x WHERE rn = 1
)
SELECT
  g.designation,
  g.raw_designation,
  g.occurrences,
  g.ca_ht,
  bc.client_id AS best_candidate_id,
  bc.client_name AS best_candidate_name,
  ROUND(bc.score::numeric, 3) AS best_score,
  r.client_name AS learned_rule_client,
  r.confidence_pct AS learned_rule_confidence,
  CASE
    WHEN g.designation ILIKE 'vente %' OR g.designation ILIKE '%tronçonneuse%' OR g.designation ILIKE '%débroussailleuse%'
      THEN 'classer_hors_client_materiel'
    WHEN r.confidence_pct >= 90 THEN 'rattacher_regle_apprise'
    WHEN bc.score >= 0.90 THEN 'rattacher_client_existant'
    WHEN bc.score >= 0.70 THEN 'valider_manuellement_suggestion'
    ELSE 'creer_client_apres_validation'
  END AS recommended_action,
  g.entry_ids
FROM grouped g
LEFT JOIN best_client bc ON bc.key = g.key
LEFT JOIN public.v_ca_match_rules r ON r.normalized_designation = g.key
ORDER BY g.ca_ht DESC;

GRANT SELECT ON public.v_ca_match_rules TO authenticated;
GRANT SELECT ON public.v_ca_orphans_report TO authenticated;
