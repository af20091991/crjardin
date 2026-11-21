-- Mission « Haie » (Lionel, client d'Aboville, 22/05/2026) : prestataire seul sur le chantier.
-- Idempotent.
UPDATE public.subcontractor_missions
SET sst_mode = 'autonome'
WHERE id = '7c84d24e-8d93-4f1d-91e6-f6e0a03a5158'
  AND archived_at IS NULL
  AND sst_mode IS NULL;
