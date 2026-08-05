CREATE TABLE public.ceev_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT,
  site_address TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'actif',
  frequency TEXT NOT NULL DEFAULT 'mensuelle',
  next_intervention_date DATE,
  notes TEXT,
  renewed_from_id UUID REFERENCES public.ceev_agreements(id) ON DELETE SET NULL,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ceev_agreements_status_check CHECK (status IN ('actif','a_renouveler','termine','suspendu')),
  CONSTRAINT ceev_agreements_frequency_check CHECK (frequency IN ('mensuelle','trimestrielle','personnalisee'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceev_agreements TO authenticated;
GRANT ALL ON public.ceev_agreements TO service_role;
ALTER TABLE public.ceev_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own ceev agreements"
  ON public.ceev_agreements FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ceev_agreements_client_idx ON public.ceev_agreements(client_id);
CREATE INDEX ceev_agreements_user_idx ON public.ceev_agreements(user_id);

CREATE TABLE public.ceev_agreement_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agreement_id UUID NOT NULL REFERENCES public.ceev_agreements(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  label TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ceev_agreement_events_type_check CHECK (event_type IN ('creation','modification','renouvellement','archivage'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceev_agreement_events TO authenticated;
GRANT ALL ON public.ceev_agreement_events TO service_role;
ALTER TABLE public.ceev_agreement_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own ceev events"
  ON public.ceev_agreement_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ceev_agreement_events_agreement_idx ON public.ceev_agreement_events(agreement_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ceev_agreements_updated_at
BEFORE UPDATE ON public.ceev_agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();