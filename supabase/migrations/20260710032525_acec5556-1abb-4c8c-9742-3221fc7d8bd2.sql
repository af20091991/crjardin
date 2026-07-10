
CREATE TYPE public.pilot_family AS ENUM ('sap', 'amenagement', 'conseil');

-- Suivi quotidien du CA
CREATE TABLE public.pilot_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT current_date,
  client_id UUID REFERENCES public.clients ON DELETE SET NULL,
  client_name TEXT,
  family public.pilot_family NOT NULL DEFAULT 'amenagement',
  nature TEXT,
  amount_ht NUMERIC NOT NULL DEFAULT 0,
  amount_ttc NUMERIC NOT NULL DEFAULT 0,
  hours NUMERIC NOT NULL DEFAULT 0,
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_entries TO authenticated;
GRANT ALL ON public.pilot_entries TO service_role;
ALTER TABLE public.pilot_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pilot_entries" ON public.pilot_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_pilot_entries_user_date ON public.pilot_entries (user_id, entry_date);

-- Charges
CREATE TABLE public.pilot_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  kind TEXT NOT NULL DEFAULT 'fixe',
  amount NUMERIC NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'mensuel',
  charge_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_charges TO authenticated;
GRANT ALL ON public.pilot_charges TO service_role;
ALTER TABLE public.pilot_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pilot_charges" ON public.pilot_charges
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Objectifs
CREATE TABLE public.pilot_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year INT NOT NULL,
  month INT,
  family public.pilot_family,
  client_id UUID REFERENCES public.clients ON DELETE CASCADE,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_objectives TO authenticated;
GRANT ALL ON public.pilot_objectives TO service_role;
ALTER TABLE public.pilot_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pilot_objectives" ON public.pilot_objectives
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Paramètres de pilotage (une ligne par utilisateur)
CREATE TABLE public.pilot_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  target_tjm NUMERIC NOT NULL DEFAULT 0,
  target_hourly_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  weekly_hours NUMERIC NOT NULL DEFAULT 35,
  monthly_fixed_charges NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_settings TO authenticated;
GRANT ALL ON public.pilot_settings TO service_role;
ALTER TABLE public.pilot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pilot_settings" ON public.pilot_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers updated_at
CREATE TRIGGER update_pilot_entries_updated_at BEFORE UPDATE ON public.pilot_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pilot_charges_updated_at BEFORE UPDATE ON public.pilot_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pilot_objectives_updated_at BEFORE UPDATE ON public.pilot_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pilot_settings_updated_at BEFORE UPDATE ON public.pilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
