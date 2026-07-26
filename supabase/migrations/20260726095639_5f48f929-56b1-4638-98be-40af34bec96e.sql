CREATE TABLE public.pilot_historic_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  hours numeric NOT NULL,
  raw_client_text text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount_ht numeric,
  margin_net numeric,
  source_file text,
  source_sheet text,
  source_row integer,
  confidence text NOT NULL DEFAULT 'faible',
  status text NOT NULL DEFAULT 'a_valider',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pilot_historic_hours_confidence_check CHECK (confidence IN ('haute','moyenne','faible')),
  CONSTRAINT pilot_historic_hours_status_check CHECK (status IN ('valide','a_valider','non_attribue'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_historic_hours TO authenticated;
GRANT ALL ON public.pilot_historic_hours TO service_role;
ALTER TABLE public.pilot_historic_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own historic hours"
  ON public.pilot_historic_hours FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pilot_historic_hours_client ON public.pilot_historic_hours(client_id);
CREATE INDEX idx_pilot_historic_hours_status ON public.pilot_historic_hours(status);

CREATE TRIGGER update_pilot_historic_hours_updated_at
  BEFORE UPDATE ON public.pilot_historic_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pilot_hours_match_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours_id uuid NOT NULL REFERENCES public.pilot_historic_hours(id) ON DELETE CASCADE,
  previous_client_id uuid,
  new_client_id uuid,
  method text NOT NULL,
  note text,
  decided_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pilot_hours_match_log TO authenticated;
GRANT ALL ON public.pilot_hours_match_log TO service_role;
ALTER TABLE public.pilot_hours_match_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own hours match log"
  ON public.pilot_hours_match_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users write their own hours match log"
  ON public.pilot_hours_match_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);