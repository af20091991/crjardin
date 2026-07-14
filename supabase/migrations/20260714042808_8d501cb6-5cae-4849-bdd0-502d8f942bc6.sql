-- Table: heures de travail mensuelles (temps terrain + jours travaillés)
CREATE TABLE public.pilot_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  temps_terrain NUMERIC,
  jours_travailles NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_hours TO authenticated;
GRANT ALL ON public.pilot_hours TO service_role;

ALTER TABLE public.pilot_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own hours" ON public.pilot_hours
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_hours_updated_at
  BEFORE UPDATE ON public.pilot_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: paramètres taux horaire / TJM (une ligne par utilisateur)
CREATE TABLE public.pilot_tjm_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  heures_gestion NUMERIC NOT NULL DEFAULT 60,
  objectif_remuneration NUMERIC NOT NULL DEFAULT 3500,
  revenus_bruts NUMERIC NOT NULL DEFAULT 60900,
  charges_fixes NUMERIC NOT NULL DEFAULT 638.695,
  charges_variables NUMERIC NOT NULL DEFAULT 2893.04,
  conges NUMERIC NOT NULL DEFAULT 56,
  jours_off NUMERIC NOT NULL DEFAULT 22,
  weekend NUMERIC NOT NULL DEFAULT 88,
  feries NUMERIC NOT NULL DEFAULT 3,
  meteo NUMERIC NOT NULL DEFAULT 4,
  bureau NUMERIC NOT NULL DEFAULT 25.75,
  heures_jour NUMERIC NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_tjm_settings TO authenticated;
GRANT ALL ON public.pilot_tjm_settings TO service_role;

ALTER TABLE public.pilot_tjm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tjm settings" ON public.pilot_tjm_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_tjm_settings_updated_at
  BEFORE UPDATE ON public.pilot_tjm_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();