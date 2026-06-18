-- Favorite tasks
CREATE TABLE public.favorite_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_tasks TO authenticated;
GRANT ALL ON public.favorite_tasks TO service_role;
ALTER TABLE public.favorite_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorite tasks" ON public.favorite_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Interventions: title + reference
ALTER TABLE public.interventions ADD COLUMN title text;
ALTER TABLE public.interventions ADD COLUMN reference text;

-- Recommendations: pricing + source
ALTER TABLE public.recommendations ADD COLUMN estimated_hours numeric;
ALTER TABLE public.recommendations ADD COLUMN unit_price numeric NOT NULL DEFAULT 70;
ALTER TABLE public.recommendations ADD COLUMN source text NOT NULL DEFAULT 'manuel';

-- Profile: signature + hourly rate
ALTER TABLE public.profiles ADD COLUMN signature_data text;
ALTER TABLE public.profiles ADD COLUMN hourly_rate numeric NOT NULL DEFAULT 70;

-- Reference counter table (per user, per year)
CREATE TABLE public.intervention_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_counters TO authenticated;
GRANT ALL ON public.intervention_counters TO service_role;
ALTER TABLE public.intervention_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own counters" ON public.intervention_counters
  FOR SELECT USING (auth.uid() = user_id);

-- Function to generate next reference, atomically
CREATE OR REPLACE FUNCTION public.next_intervention_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  yr int := EXTRACT(YEAR FROM now())::int;
  seq int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  INSERT INTO public.intervention_counters (user_id, year, last_seq)
  VALUES (uid, yr, 1)
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_seq = public.intervention_counters.last_seq + 1
  RETURNING last_seq INTO seq;
  RETURN 'CR-' || yr::text || '-' || lpad(seq::text, 5, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_intervention_reference() TO authenticated;