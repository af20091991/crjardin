-- Type de sous-traitance : 'autonome' (le prestataire réalise seul la mission, marge = prix client − coût SST)
-- ou 'accompagnee' (le gérant accompagne : le coût SST est une charge de chantier).
-- Idempotent. NULL = non renseigné (traité comme autonome, comportement historique).
ALTER TABLE public.subcontractor_missions ADD COLUMN IF NOT EXISTS sst_mode text;
ALTER TABLE public.subcontractor_missions DROP CONSTRAINT IF EXISTS subcontractor_missions_sst_mode_check;
ALTER TABLE public.subcontractor_missions ADD CONSTRAINT subcontractor_missions_sst_mode_check
  CHECK (sst_mode IS NULL OR sst_mode IN ('autonome', 'accompagnee'));
