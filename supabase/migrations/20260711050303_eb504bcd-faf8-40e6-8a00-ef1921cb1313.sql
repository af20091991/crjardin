CREATE TABLE public.pilot_ca_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  kind TEXT NOT NULL CHECK (kind IN ('vente','charge','remuneration')),
  designation TEXT,
  amount_ht NUMERIC NOT NULL DEFAULT 0,
  hours NUMERIC,
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_ca_entries TO authenticated;
GRANT ALL ON public.pilot_ca_entries TO service_role;

ALTER TABLE public.pilot_ca_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own CA entries"
  ON public.pilot_ca_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pilot_ca_entries_user_period ON public.pilot_ca_entries (user_id, year, month);

CREATE TRIGGER update_pilot_ca_entries_updated_at
  BEFORE UPDATE ON public.pilot_ca_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();