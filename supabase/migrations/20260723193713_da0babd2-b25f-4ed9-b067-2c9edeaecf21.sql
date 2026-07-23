
-- =========================================================================
-- M-0 — SOCLE PILOT PRO v2 (préparatoire, sans modification de données métier)
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Journal unique des migrations Pilot Pro v2
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pilot_migration_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step TEXT NOT NULL,                 -- ex: 'M-0', 'M-1', 'M-1.2'...
  phase TEXT,                          -- sous-phase optionnelle
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | failed | rolled_back
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_migration_log_step ON public.pilot_migration_log(step);
CREATE INDEX IF NOT EXISTS idx_pilot_migration_log_status ON public.pilot_migration_log(status);

GRANT SELECT, INSERT, UPDATE ON public.pilot_migration_log TO authenticated;
GRANT ALL ON public.pilot_migration_log TO service_role;

ALTER TABLE public.pilot_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_log_read_authenticated"
  ON public.pilot_migration_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "migration_log_write_admin"
  ON public.pilot_migration_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "migration_log_update_admin"
  ON public.pilot_migration_log FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 2) Conservation des sources Excel sur pilot_ca_entries
--    (ajout non-destructif : toutes colonnes nullables, aucune valeur écrite)
-- -------------------------------------------------------------------------
ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS raw_designation TEXT,
  ADD COLUMN IF NOT EXISTS raw_category TEXT,
  ADD COLUMN IF NOT EXISTS raw_client_text TEXT,
  ADD COLUMN IF NOT EXISTS source_file TEXT,
  ADD COLUMN IF NOT EXISTS source_sheet TEXT,
  ADD COLUMN IF NOT EXISTS source_row INTEGER,
  ADD COLUMN IF NOT EXISTS fiscal_tag TEXT;  -- sap | ceev | ap | conseil | autre | null

CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_fiscal_tag ON public.pilot_ca_entries(fiscal_tag);
CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_source_file ON public.pilot_ca_entries(source_file);

-- -------------------------------------------------------------------------
-- 3) Système générique de contrôle qualité (remplace pilot_review_flags)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pilot_quality_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_table TEXT NOT NULL,          -- ex: 'pilot_ca_entries', 'clients', 'services'
  target_id UUID,                       -- ligne concernée (nullable pour checks agrégés)
  check_type TEXT NOT NULL,            -- ex: 'orphan_client', 'ambiguous_designation', 'missing_hours'
  severity TEXT NOT NULL DEFAULT 'info', -- info | warning | error | blocker
  status TEXT NOT NULL DEFAULT 'open',  -- open | reviewing | resolved | ignored
  message TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_by TEXT,                     -- migration/step/rule name
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_quality_target ON public.pilot_quality_checks(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_pilot_quality_type ON public.pilot_quality_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_pilot_quality_status ON public.pilot_quality_checks(status);
CREATE INDEX IF NOT EXISTS idx_pilot_quality_severity ON public.pilot_quality_checks(severity);

GRANT SELECT, INSERT, UPDATE ON public.pilot_quality_checks TO authenticated;
GRANT ALL ON public.pilot_quality_checks TO service_role;

ALTER TABLE public.pilot_quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quality_checks_read_authenticated"
  ON public.pilot_quality_checks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "quality_checks_write_admin"
  ON public.pilot_quality_checks FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "quality_checks_update_admin"
  ON public.pilot_quality_checks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 4) Socle service_contracts (contrats d'entretien récurrents) — vide
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  label TEXT,
  frequency TEXT,                       -- weekly | biweekly | monthly | quarterly | yearly | custom
  frequency_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  annual_value_ht NUMERIC(12,2),
  next_due_date DATE,
  seasonality JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: { "months": [3,4,5,9,10] }
  status TEXT NOT NULL DEFAULT 'draft', -- draft | active | paused | ended
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_contracts_user ON public.service_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_client ON public.service_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_status ON public.service_contracts(status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_next_due ON public.service_contracts(next_due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_contracts TO authenticated;
GRANT ALL ON public.service_contracts TO service_role;

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_contracts_owner_all"
  ON public.service_contracts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 5) Trigger updated_at partagé (idempotent)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilot_migration_log_updated ON public.pilot_migration_log;
CREATE TRIGGER trg_pilot_migration_log_updated
  BEFORE UPDATE ON public.pilot_migration_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pilot_quality_checks_updated ON public.pilot_quality_checks;
CREATE TRIGGER trg_pilot_quality_checks_updated
  BEFORE UPDATE ON public.pilot_quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_service_contracts_updated ON public.service_contracts;
CREATE TRIGGER trg_service_contracts_updated
  BEFORE UPDATE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 6) Empreinte M-0 dans le journal
-- -------------------------------------------------------------------------
INSERT INTO public.pilot_migration_log (step, phase, status, summary, details, started_at, finished_at)
VALUES (
  'M-0',
  'socle',
  'done',
  'Socle Pilot Pro v2 : journal migrations, colonnes brutes CA, contrôle qualité générique, socle service_contracts, fiscal_tag.',
  jsonb_build_object(
    'created_tables', jsonb_build_array('pilot_migration_log','pilot_quality_checks','service_contracts'),
    'altered_tables', jsonb_build_array('pilot_ca_entries'),
    'added_columns', jsonb_build_array(
      'pilot_ca_entries.raw_designation',
      'pilot_ca_entries.raw_category',
      'pilot_ca_entries.raw_client_text',
      'pilot_ca_entries.source_file',
      'pilot_ca_entries.source_sheet',
      'pilot_ca_entries.source_row',
      'pilot_ca_entries.fiscal_tag'
    ),
    'business_data_modified', false
  ),
  now(),
  now()
);
