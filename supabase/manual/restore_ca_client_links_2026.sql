-- Restauration des liens client des ventes 2026 perdues lors de la suppression de compte du 31/10/2026 (05:08:57 UTC).
-- À exécuter MANUELLEMENT dans l'éditeur SQL Supabase du projet mgkeqwwzhcodntkakqaz, après relecture.
-- Ne modifie que les 11 lignes de vente sans client, horodatées à l'instant de la suppression.
-- Si le nombre de lignes touchées n'est pas exactement 11, la transaction est annulée.

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.pilot_ca_entries
  WHERE kind = 'vente' AND year = 2026 AND client_id IS NULL
    AND updated_at = '2026-10-31 05:08:57.011928+00';
  IF n <> 11 THEN
    RAISE EXCEPTION 'Attendu 11 lignes orphelines, trouvé %. Arrêt.', n;
  END IF;
END
$$;

UPDATE public.pilot_ca_entries AS e
SET client_id = CASE
  WHEN e.month = 8  AND e.amount_ht = 46.00   THEN '9ff53ef7-a038-4408-971e-86753a57b7bd'::uuid -- Mesuré
  WHEN e.month = 9  AND e.amount_ht = 207.17  THEN '9ff53ef7-a038-4408-971e-86753a57b7bd'::uuid -- Mesuré
  WHEN e.month = 12 AND e.amount_ht = 207.17  THEN '9ff53ef7-a038-4408-971e-86753a57b7bd'::uuid -- Mesuré
  ELSE '251e55fd-bdff-42e7-abbd-bbbb7c5aac3e'::uuid                                             -- Chauveau
END
WHERE e.kind = 'vente' AND e.year = 2026 AND e.client_id IS NULL
  AND e.updated_at = '2026-10-31 05:08:57.011928+00';

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.pilot_ca_entries
  WHERE kind = 'vente' AND year = 2026 AND client_id IS NULL
    AND updated_at = '2026-10-31 05:08:57.011928+00';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Il reste % ligne(s) sans client. Arrêt.', n;
  END IF;
END
$$;

-- Vérification avant validation : 9 756,44 € HT attendus, répartis entre les deux clients
SELECT c.name, count(*) AS lignes, round(sum(e.amount_ht)::numeric, 2) AS total_ht
FROM public.pilot_ca_entries e
JOIN public.clients c ON c.id = e.client_id
WHERE e.kind = 'vente' AND e.year = 2026
  AND e.client_id IN ('251e55fd-bdff-42e7-abbd-bbbb7c5aac3e', '9ff53ef7-a038-4408-971e-86753a57b7bd')
  AND e.updated_at = '2026-10-31 05:08:57.011928+00'
GROUP BY c.name;

-- Si le résultat est conforme : remplacer ROLLBACK par COMMIT et relancer.
ROLLBACK;
