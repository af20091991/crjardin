-- Assistant AP : catalogue fournisseurs, mémoire d'association fourniture → fournisseur
-- (import de devis). Idempotent.

ALTER TABLE public.ap_suppliers
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS catalogue text;

CREATE TABLE IF NOT EXISTS public.ap_supplier_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_key text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.ap_suppliers(id) ON DELETE CASCADE,
  hits integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (norm_key, supplier_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_supplier_memory TO authenticated;
GRANT ALL ON public.ap_supplier_memory TO service_role;
ALTER TABLE public.ap_supplier_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved members read AP supplier memory" ON public.ap_supplier_memory;
CREATE POLICY "Approved members read AP supplier memory" ON public.ap_supplier_memory
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
DROP POLICY IF EXISTS "Approved members insert AP supplier memory" ON public.ap_supplier_memory;
CREATE POLICY "Approved members insert AP supplier memory" ON public.ap_supplier_memory
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_member(auth.uid()));
DROP POLICY IF EXISTS "Approved members update AP supplier memory" ON public.ap_supplier_memory;
CREATE POLICY "Approved members update AP supplier memory" ON public.ap_supplier_memory
  FOR UPDATE TO authenticated USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));
DROP POLICY IF EXISTS "Approved members delete AP supplier memory" ON public.ap_supplier_memory;
CREATE POLICY "Approved members delete AP supplier memory" ON public.ap_supplier_memory
  FOR DELETE TO authenticated USING (public.is_approved_member(auth.uid()));

DROP TRIGGER IF EXISTS ap_supplier_memory_set_updated_at ON public.ap_supplier_memory;
CREATE TRIGGER ap_supplier_memory_set_updated_at
  BEFORE UPDATE ON public.ap_supplier_memory
  FOR EACH ROW EXECUTE FUNCTION public.ap_set_updated_at();

-- Fournisseur manquant du catalogue.
INSERT INTO public.ap_suppliers (name)
SELECT 'LR Merlin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ap_suppliers WHERE lower(btrim(name)) IN ('lr merlin', 'leroy merlin')
);

-- Catalogue (texte lisible) + alias de noms. Les fournisseurs existants gardent leur nom.
UPDATE public.ap_suppliers SET
  aliases = ARRAY['Berger et fils', 'Berger et Fils', 'B&F'],
  catalogue = 'Terre végétale, terre végétale enrichie, terre végétale conteneur 35L.'
WHERE lower(btrim(name)) IN ('b&f', 'berger et fils');

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Touchat'],
  catalogue = 'Fournitures espaces verts : amendement, paillage organique, ganivelles, terreau biologique professionnel.'
WHERE lower(btrim(name)) = 'touchat';

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Arc en fleurs', 'Arc-en-fleurs', 'AEF'],
  catalogue = 'Végétaux et vivaces en dessous de 5L.'
WHERE lower(btrim(name)) = 'aef';

UPDATE public.ap_suppliers SET
  aliases = ARRAY['SJ34'],
  catalogue = 'Arbustes, grimpantes et arbres de 3L à >30L. Spécificités : terreau biologique (autre que « professionnel »), terre végétale biologique, arbustes de haie H1, H2 et H3.'
WHERE lower(btrim(name)) = 'sj34';

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Ruiz'],
  catalogue = 'Arbustes, grimpantes et arbres de 3L à >30L.'
WHERE lower(btrim(name)) = 'ruiz';

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Pousse-Clanet', 'Pousse Clanet', 'PC'],
  catalogue = 'Arbustes, grimpantes et arbres de 3L à >30L. Spécificité : terreau composé (spécifique Pousse-Clanet).'
WHERE lower(btrim(name)) = 'pc';

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Leroy Merlin', 'LR Merlin'],
  catalogue = 'Canisses, fournitures de fixation.'
WHERE lower(btrim(name)) IN ('lr merlin', 'leroy merlin');

UPDATE public.ap_suppliers SET
  aliases = ARRAY['Granier'],
  catalogue = 'Traverses, gravier, sable, pas japonais, dallage, bordure écolat, bordure corten.'
WHERE lower(btrim(name)) = 'granier';
