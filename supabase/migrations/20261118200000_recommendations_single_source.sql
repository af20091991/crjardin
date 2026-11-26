-- Préconisations centralisées : la table recommendations est la seule source.
-- 1) Les lignes de texte des CR absentes de la table sont créées (statut proposee).
-- 2) Le texte du CR (interventions.recommendations_text) est recalculé à partir des lignes,
--    à chaque ajout, modification ou suppression. Idempotent.

BEGIN;

-- 1) Reprise des lignes de texte manquantes
INSERT INTO public.recommendations
  (user_id, client_id, intervention_id, title, status, source, include_in_report)
SELECT DISTINCT ON (x.iv_id, lower(x.line))
  i.user_id, i.client_id, x.iv_id, left(x.line, 200), 'proposee', 'cr_texte', true
FROM (
  SELECT i0.id AS iv_id, trim(l) AS line
  FROM public.interventions i0,
       regexp_split_to_table(coalesce(i0.recommendations_text, ''), E'\n') AS l
  WHERE trim(l) <> ''
) x
JOIN public.interventions i ON i.id = x.iv_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.recommendations r
  WHERE r.intervention_id = x.iv_id
    AND lower(trim(r.title)) = lower(x.line)
);

-- 2) Texte du CR dérivé des lignes
CREATE OR REPLACE FUNCTION public.rebuild_recommendations_text(p_intervention uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
BEGIN
  IF p_intervention IS NULL THEN
    RETURN;
  END IF;
  SELECT string_agg(r.title, E'\n' ORDER BY r.report_position NULLS LAST, r.created_at)
    INTO v_text
  FROM public.recommendations r
  WHERE r.intervention_id = p_intervention
    AND r.include_in_report
    AND r.status <> 'refusee';
  UPDATE public.interventions
     SET recommendations_text = nullif(v_text, '')
   WHERE id = p_intervention;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_sync_recommendations_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.rebuild_recommendations_text(OLD.intervention_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.rebuild_recommendations_text(NEW.intervention_id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_recommendations_text ON public.recommendations;
CREATE TRIGGER trg_sync_recommendations_text
  AFTER INSERT OR UPDATE OR DELETE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_recommendations_text();

-- 3) Recalcul initial pour tous les CR ayant des préconisations
SELECT public.rebuild_recommendations_text(i.id)
FROM public.interventions i
WHERE i.id IN (SELECT intervention_id FROM public.recommendations WHERE intervention_id IS NOT NULL);

COMMIT;
