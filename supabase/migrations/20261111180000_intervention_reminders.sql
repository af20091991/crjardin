-- Rappel d'intervention J-2 : journal d'envoi et de confirmation par intervention.
CREATE TABLE public.intervention_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  message_id TEXT,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intervention_id, scheduled_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_reminders TO authenticated;
GRANT ALL ON public.intervention_reminders TO service_role;

ALTER TABLE public.intervention_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members manage intervention reminders"
  ON public.intervention_reminders
  FOR ALL TO authenticated
  USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));
