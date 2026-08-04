-- =========================================================
-- SITES
-- =========================================================
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  access_complement text,
  latitude numeric,
  longitude numeric,
  worksite_sheet_id uuid REFERENCES public.worksite_sheets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'canonique',
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_select_own" ON public.sites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sites_insert_own" ON public.sites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sites_update_own" ON public.sites FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sites_delete_own" ON public.sites FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX sites_client_idx ON public.sites(client_id);
CREATE INDEX sites_user_idx ON public.sites(user_id);

-- =========================================================
-- ALIAS DE SITES
-- =========================================================
CREATE TABLE public.site_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_normalized text NOT NULL,
  origin text NOT NULL DEFAULT 'manuel',
  legacy_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_aliases TO authenticated;
GRANT ALL ON public.site_aliases TO service_role;
ALTER TABLE public.site_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_aliases_select_own" ON public.site_aliases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "site_aliases_insert_own" ON public.site_aliases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "site_aliases_update_own" ON public.site_aliases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "site_aliases_delete_own" ON public.site_aliases FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX site_aliases_unique ON public.site_aliases(user_id, alias_normalized);

-- =========================================================
-- CONTACTS
-- =========================================================
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  civility text,
  first_name text,
  last_name text,
  display_name text NOT NULL,
  role text,
  emails text[] NOT NULL DEFAULT '{}'::text[],
  phone text,
  is_report_recipient boolean NOT NULL DEFAULT true,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select_own" ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert_own" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_update_own" ON public.contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_delete_own" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX contacts_client_idx ON public.contacts(client_id);

-- =========================================================
-- PROPOSITIONS DE REGROUPEMENT (validation humaine obligatoire)
-- =========================================================
CREATE TABLE public.site_merge_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cluster_key text NOT NULL,
  suggested_client_name text NOT NULL,
  suggested_site_name text NOT NULL,
  legacy_client_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  legacy_labels text[] NOT NULL DEFAULT '{}'::text[],
  target_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  target_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  impact_interventions integer NOT NULL DEFAULT 0,
  impact_ca_entries integer NOT NULL DEFAULT 0,
  impact_ca_amount numeric NOT NULL DEFAULT 0,
  impact_hours numeric NOT NULL DEFAULT 0,
  impact_missions integer NOT NULL DEFAULT 0,
  confidence numeric,
  status text NOT NULL DEFAULT 'en_attente',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_merge_proposals TO authenticated;
GRANT ALL ON public.site_merge_proposals TO service_role;
ALTER TABLE public.site_merge_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smp_select_own" ON public.site_merge_proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "smp_insert_own" ON public.site_merge_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "smp_update_own" ON public.site_merge_proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "smp_delete_own" ON public.site_merge_proposals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX smp_cluster_unique ON public.site_merge_proposals(user_id, cluster_key);

-- =========================================================
-- RATTACHEMENTS (facultatifs : les calculs actuels restent valides)
-- =========================================================
ALTER TABLE public.interventions ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.interventions ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.pilot_ca_entries ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.pilot_historic_hours ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.subcontractor_missions ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.worksite_sheets ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN default_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN merged_into_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN merged_reason text;
ALTER TABLE public.clients ADD COLUMN merged_at timestamptz;

CREATE INDEX interventions_site_idx ON public.interventions(site_id);
CREATE INDEX pilot_ca_entries_site_idx ON public.pilot_ca_entries(site_id);

-- =========================================================
-- TRIGGERS updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER site_aliases_updated_at BEFORE UPDATE ON public.site_aliases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER smp_updated_at BEFORE UPDATE ON public.site_merge_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
