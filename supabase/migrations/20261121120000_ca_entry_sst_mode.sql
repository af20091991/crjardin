-- Qualification de chaque charge SST : 'autonome' (prestataire seul) ou 'accompagnee'
-- (chantier auquel le gérant participe). NULL = à qualifier. Idempotent.
ALTER TABLE public.pilot_ca_entries ADD COLUMN IF NOT EXISTS sst_mode text;
ALTER TABLE public.pilot_ca_entries DROP CONSTRAINT IF EXISTS pilot_ca_entries_sst_mode_check;
ALTER TABLE public.pilot_ca_entries ADD CONSTRAINT pilot_ca_entries_sst_mode_check
  CHECK (sst_mode IS NULL OR sst_mode IN ('autonome', 'accompagnee'));
