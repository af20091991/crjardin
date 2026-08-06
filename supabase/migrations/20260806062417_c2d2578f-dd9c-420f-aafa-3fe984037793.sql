ALTER TABLE public.pilot_ca_entries ADD COLUMN IF NOT EXISTS intervention_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pilot_ca_entries_intervention_type_check'
  ) THEN
    ALTER TABLE public.pilot_ca_entries
      ADD CONSTRAINT pilot_ca_entries_intervention_type_check
      CHECK (intervention_type IS NULL OR intervention_type IN ('interne','sst'));
  END IF;
END $$;

COMMENT ON COLUMN public.pilot_ca_entries.intervention_type IS
  'Type d''intervention de la ligne de vente : interne (temps interne consomme) ou sst (sous-traitee, temps 0 valide). NULL = non renseigne, aucune valeur deduite automatiquement.';