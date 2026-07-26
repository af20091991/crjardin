ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS report_waived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_waived_reason TEXT;

CREATE TABLE IF NOT EXISTS public.pilot_fixed_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_fixed_charges TO authenticated;
GRANT ALL ON public.pilot_fixed_charges TO service_role;

ALTER TABLE public.pilot_fixed_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own fixed charges"
  ON public.pilot_fixed_charges FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_pilot_fixed_charges_updated_at ON public.pilot_fixed_charges;
CREATE TRIGGER update_pilot_fixed_charges_updated_at
  BEFORE UPDATE ON public.pilot_fixed_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS pilot_fixed_charges_unique
  ON public.pilot_fixed_charges (user_id, year, label);

INSERT INTO public.pilot_fixed_charges (user_id, year, label, monthly_amount, position)
SELECT u.user_id, 2026, c.label, c.amount, c.pos
FROM (SELECT DISTINCT user_id FROM public.pilot_settings) u
CROSS JOIN (VALUES
  ('Expert-comptable (MCECO)', 124.00, 0),
  ('Loyer', 65.00, 1),
  ('CFE', 43.25, 2),
  ('PER', 150.00, 3),
  ('Free', 16.66, 4),
  ('Crédit Agricole et divers', 21.00, 5),
  ('Adhésion Accès SAP', 2.08, 6),
  ('Auto', 132.77, 7),
  ('RC', 26.95, 8),
  ('Prévoyance', 89.58, 9),
  ('Mutuelle', 52.15, 10),
  ('Site web', 2.28, 11)
) AS c(label, amount, pos)
ON CONFLICT (user_id, year, label) DO NOTHING;