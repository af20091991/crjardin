-- Pré-devis : catalogue fournisseurs (Excel + export Henrri).
-- Accès réservé aux administrateurs. Aucune écriture dans les tables ap_*.

CREATE OR REPLACE FUNCTION public.predevis_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. Fournisseurs propres au Pré-devis
CREATE TABLE IF NOT EXISTS public.predevis_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  norm_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predevis_suppliers_norm_name_key UNIQUE (norm_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_suppliers TO authenticated;
GRANT ALL ON public.predevis_suppliers TO service_role;
ALTER TABLE public.predevis_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_suppliers" ON public.predevis_suppliers;
CREATE POLICY "Admins manage predevis_suppliers" ON public.predevis_suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_suppliers_set_updated_at ON public.predevis_suppliers;
CREATE TRIGGER predevis_suppliers_set_updated_at
  BEFORE UPDATE ON public.predevis_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();

-- 2. Journal des imports (une ligne par fichier importé)
CREATE TABLE IF NOT EXISTS public.predevis_catalogue_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('excel', 'henrri')),
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  missing_price_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_catalogue_imports TO authenticated;
GRANT ALL ON public.predevis_catalogue_imports TO service_role;
ALTER TABLE public.predevis_catalogue_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_catalogue_imports" ON public.predevis_catalogue_imports;
CREATE POLICY "Admins manage predevis_catalogue_imports" ON public.predevis_catalogue_imports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Produits (une référence = un produit, mis à jour à chaque import)
CREATE TABLE IF NOT EXISTS public.predevis_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_code text NOT NULL,
  code text NOT NULL,
  designation text NOT NULL,
  norm_designation text NOT NULL,
  unit text,
  family text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predevis_products_norm_code_key UNIQUE (norm_code)
);

CREATE INDEX IF NOT EXISTS predevis_products_norm_designation_idx
  ON public.predevis_products (norm_designation);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_products TO authenticated;
GRANT ALL ON public.predevis_products TO service_role;
ALTER TABLE public.predevis_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_products" ON public.predevis_products;
CREATE POLICY "Admins manage predevis_products" ON public.predevis_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_products_set_updated_at ON public.predevis_products;
CREATE TRIGGER predevis_products_set_updated_at
  BEFORE UPDATE ON public.predevis_products
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();

-- 4. Offres : prix d'achat HT par produit × fournisseur × source.
--    supplier_id NULL = fournisseur non précisé (export Henrri).
--    Une source ne peut avoir qu'une valeur par produit × fournisseur ;
--    le réimport d'une source remplace ses propres valeurs.
--    Entre sources, la valeur la plus haute est retenue à la lecture.
CREATE TABLE IF NOT EXISTS public.predevis_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.predevis_products(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.predevis_suppliers(id) ON DELETE CASCADE,
  supplier_key uuid GENERATED ALWAYS AS (COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  source text NOT NULL CHECK (source IN ('excel', 'henrri')),
  pau_ht numeric(12,4),
  pau_raw text,
  source_import_id uuid REFERENCES public.predevis_catalogue_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predevis_offers_key UNIQUE (product_id, supplier_key, source)
);

CREATE INDEX IF NOT EXISTS predevis_offers_supplier_idx ON public.predevis_offers (supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predevis_offers TO authenticated;
GRANT ALL ON public.predevis_offers TO service_role;
ALTER TABLE public.predevis_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage predevis_offers" ON public.predevis_offers;
CREATE POLICY "Admins manage predevis_offers" ON public.predevis_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS predevis_offers_set_updated_at ON public.predevis_offers;
CREATE TRIGGER predevis_offers_set_updated_at
  BEFORE UPDATE ON public.predevis_offers
  FOR EACH ROW EXECUTE FUNCTION public.predevis_set_updated_at();
