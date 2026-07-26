
ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS charge_class text,
  ADD COLUMN IF NOT EXISTS charge_category text;

CREATE TABLE IF NOT EXISTS public.pilot_charge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  charge_class text NOT NULL DEFAULT 'variable',
  keywords text[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_charge_categories TO authenticated;
GRANT ALL ON public.pilot_charge_categories TO service_role;

ALTER TABLE public.pilot_charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pilot_charge_categories"
  ON public.pilot_charge_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_charge_categories_updated_at
  BEFORE UPDATE ON public.pilot_charge_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed des catégories prioritaires pour chaque utilisateur ayant des charges
INSERT INTO public.pilot_charge_categories (user_id, label, charge_class, keywords, position)
SELECT DISTINCT e.user_id, c.label, c.charge_class, c.keywords, c.position
FROM public.pilot_ca_entries e
CROSS JOIN (VALUES
  ('Charges fixes', 'fixe', ARRAY['charges fixes','charge fixe'], 1),
  ('Alimentaire', 'variable', ARRAY['alimentaire'], 2),
  ('Carburant', 'variable', ARRAY['carburant','essence','gasoil','peage','péage'], 3),
  ('Déchèterie', 'variable', ARRAY['dechet','déchet','decheterie','déchèterie','dechèterie'], 4)
) AS c(label, charge_class, keywords, position)
WHERE e.kind = 'charge'
ON CONFLICT (user_id, label) DO NOTHING;

-- Classement automatique : n'écrit que charge_class / charge_category
CREATE OR REPLACE FUNCTION public.pilot_classify_charges(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer := 0;
BEGIN
  UPDATE public.pilot_ca_entries e
  SET charge_class = m.charge_class,
      charge_category = m.label
  FROM (
    SELECT DISTINCT ON (e2.id) e2.id, c.label, c.charge_class
    FROM public.pilot_ca_entries e2
    JOIN public.pilot_charge_categories c
      ON c.user_id = e2.user_id
     AND c.is_active
     AND EXISTS (
       SELECT 1 FROM unnest(c.keywords) k
       WHERE lower(unaccent_lite(coalesce(e2.designation, ''))) LIKE '%' || lower(unaccent_lite(k)) || '%'
     )
    WHERE e2.kind = 'charge'
      AND (_user_id IS NULL OR e2.user_id = _user_id)
    ORDER BY e2.id, c.position
  ) m
  WHERE e.id = m.id
    AND (e.charge_class IS DISTINCT FROM m.charge_class OR e.charge_category IS DISTINCT FROM m.label);
  GET DIAGNOSTICS touched = ROW_COUNT;

  UPDATE public.pilot_ca_entries
  SET charge_class = 'a_classer', charge_category = 'À classer'
  WHERE kind = 'charge'
    AND charge_class IS NULL
    AND (_user_id IS NULL OR user_id = _user_id);

  RETURN touched;
END;
$$;

-- Normalisation d'accents simple (pas d'extension requise)
CREATE OR REPLACE FUNCTION public.unaccent_lite(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(coalesce(t,''),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY');
$$;

CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_charge
  ON public.pilot_ca_entries (user_id, kind, year, charge_class);
