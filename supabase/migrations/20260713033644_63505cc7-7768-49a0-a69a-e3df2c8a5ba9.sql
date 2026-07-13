CREATE TABLE public.pilot_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL,
  title text NOT NULL DEFAULT '',
  deadline text,
  priority text NOT NULL DEFAULT 'moyenne',
  status text NOT NULL DEFAULT 'en_cours',
  completed_date date,
  comment text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_goals TO authenticated;
GRANT ALL ON public.pilot_goals TO service_role;

ALTER TABLE public.pilot_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goals" ON public.pilot_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_goals_updated_at
  BEFORE UPDATE ON public.pilot_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();