CREATE TABLE public.calendar_participants (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT '#94A3B8',
  icon TEXT NOT NULL DEFAULT 'user',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.calendar_participants TO authenticated;
GRANT ALL ON public.calendar_participants TO service_role;

ALTER TABLE public.calendar_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read calendar participants"
  ON public.calendar_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Own or admin can insert calendar participant"
  ON public.calendar_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Own or admin can update calendar participant"
  ON public.calendar_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_calendar_participants_updated_at
  BEFORE UPDATE ON public.calendar_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.planning_notes
  ADD COLUMN status TEXT NOT NULL DEFAULT 'chantier_bloque'
    CHECK (status IN ('disponible','chantier_bloque')),
  ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;