-- 1. Journal SST : champs issus du fichier Excel de référence
ALTER TABLE public.subcontractor_missions
  ADD COLUMN IF NOT EXISTS autonomy text,
  ADD COLUMN IF NOT EXISTS parallel_worksite text,
  ADD COLUMN IF NOT EXISTS import_source text;

-- 2. Contrats d'entretien CEEV
CREATE TABLE IF NOT EXISTS public.ceev_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  raw_label text NOT NULL,
  label text NOT NULL,
  year integer NOT NULL,
  pv_ht numeric NOT NULL DEFAULT 0,
  charges numeric NOT NULL DEFAULT 0,
  margin_net numeric NOT NULL DEFAULT 0,
  hours numeric,
  notes text,
  status text NOT NULL DEFAULT 'actif',
  match_status text NOT NULL DEFAULT 'non_identifie',
  match_score numeric,
  match_method text,
  validation_status text NOT NULL DEFAULT 'a_valider',
  import_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceev_contracts TO authenticated;
GRANT ALL ON public.ceev_contracts TO service_role;
ALTER TABLE public.ceev_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ceev_contracts_own" ON public.ceev_contracts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS ceev_contracts_user_year_idx ON public.ceev_contracts (user_id, year);
CREATE TRIGGER ceev_contracts_updated_at BEFORE UPDATE ON public.ceev_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Retour utilisateur sur les points d'attention (vue + note 1-5)
CREATE TABLE IF NOT EXISTS public.pilot_alert_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_key text NOT NULL,
  seen_at timestamptz,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_alert_feedback TO authenticated;
GRANT ALL ON public.pilot_alert_feedback TO service_role;
ALTER TABLE public.pilot_alert_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_alert_feedback_own" ON public.pilot_alert_feedback FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER pilot_alert_feedback_updated_at BEFORE UPDATE ON public.pilot_alert_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();