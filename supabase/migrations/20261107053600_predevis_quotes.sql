-- Pré-devis : devis, postes, lignes. Accès réservé aux administrateurs.
-- Ordre : CREATE → REVOKE/GRANT → ENABLE RLS → POLICY (AGENTS.md).

-- 1. Pré-devis
CREATE TABLE IF NOT EXISTS public.predevis_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  devis_number text,
  source_file_name text,
  source_sha256 text,
  total_ht_declared numeric(12,2),
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'valide')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.predevis_quotes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.predevis_quotes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_quotes TO authenticated;
GRANT ALL ON public.predevis_quotes TO service_role;
ALTER TABLE public.predevis_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_quotes" ON public.predevis_quotes;
CREATE POLICY "Admins manage predevis_quotes" ON public.predevis_quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_quotes_set_updated_at ON public.predevis_quotes;
CREATE TRIGGER predevis_quotes_set_updated_at
  BEFORE UPDATE ON public.predevis_quotes
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();

-- 2. Postes
CREATE TABLE IF NOT EXISTS public.predevis_postes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.predevis_quotes(id) ON DELETE CASCADE,
  position integer NOT NULL,
  title text NOT NULL,
  description_lines text[] NOT NULL DEFAULT '{}',
  detection text NOT NULL DEFAULT 'auto' CHECK (detection IN ('auto', 'manuel')),
  review_status text NOT NULL DEFAULT 'a_verifier' CHECK (review_status IN ('a_verifier', 'valide')),
  subtotal_ht numeric(12,2),
  client_block text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predevis_postes_position_key UNIQUE (quote_id, position)
);

REVOKE ALL ON public.predevis_postes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.predevis_postes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_postes TO authenticated;
GRANT ALL ON public.predevis_postes TO service_role;
ALTER TABLE public.predevis_postes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_postes" ON public.predevis_postes;
CREATE POLICY "Admins manage predevis_postes" ON public.predevis_postes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_postes_set_updated_at ON public.predevis_postes;
CREATE TRIGGER predevis_postes_set_updated_at
  BEFORE UPDATE ON public.predevis_postes
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();

-- 3. Lignes du devis (poste_id NULL = non affectée, à ranger dans un poste)
CREATE TABLE IF NOT EXISTS public.predevis_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.predevis_quotes(id) ON DELETE CASCADE,
  poste_id uuid REFERENCES public.predevis_postes(id) ON DELETE SET NULL,
  position integer NOT NULL,
  source_ref text,
  designation text NOT NULL,
  line_kind text NOT NULL DEFAULT 'fourniture' CHECK (line_kind IN ('fourniture', 'mo')),
  continued boolean NOT NULL DEFAULT false,
  quantity numeric(12,3),
  pu_ht numeric(12,4),
  tva_rate numeric(5,2),
  ht numeric(12,2),
  ttc numeric(12,2),
  catalogue_product_id uuid REFERENCES public.predevis_products(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.predevis_suppliers(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'aucun' CHECK (match_status IN ('code', 'designation', 'a_confirmer', 'manuel', 'aucun')),
  unit text,
  unit_multiplier numeric(12,4),
  unit_status text NOT NULL DEFAULT 'non_verifiee' CHECK (unit_status IN ('ok', 'non_verifiee')),
  pau_ht_applied numeric(12,4),
  cost_status text NOT NULL DEFAULT 'manquant' CHECK (cost_status IN ('connu', 'manquant', 'manuel', 'non_applicable')),
  manual_cost_ht numeric(12,2),
  zero_cost_reason text CHECK (zero_cost_reason IN ('remise', 'sav')),
  client_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predevis_lines_position_key UNIQUE (quote_id, position)
);

CREATE INDEX IF NOT EXISTS predevis_lines_poste_idx ON public.predevis_lines (poste_id);

REVOKE ALL ON public.predevis_lines FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.predevis_lines FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_lines TO authenticated;
GRANT ALL ON public.predevis_lines TO service_role;
ALTER TABLE public.predevis_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_lines" ON public.predevis_lines;
CREATE POLICY "Admins manage predevis_lines" ON public.predevis_lines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_lines_set_updated_at ON public.predevis_lines;
CREATE TRIGGER predevis_lines_set_updated_at
  BEFORE UPDATE ON public.predevis_lines
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();
