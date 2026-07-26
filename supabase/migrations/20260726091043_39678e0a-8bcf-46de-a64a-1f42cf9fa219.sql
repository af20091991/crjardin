ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS report_policy text NOT NULL DEFAULT 'a_confirmer',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_confidence text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_report_policy_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_report_policy_check
      CHECK (report_policy IN ('oui','non','a_confirmer'));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.report_policy IS 'Client concerné par l''envoi de comptes-rendus : oui / non / a_confirmer';
COMMENT ON COLUMN public.clients.source IS 'Origine de la fiche (ex: ca_historique)';
COMMENT ON COLUMN public.clients.source_confidence IS 'Niveau de confiance du rapprochement à l''origine de la fiche';