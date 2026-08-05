CREATE TABLE public.favorite_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_clients TO authenticated;
GRANT ALL ON public.favorite_clients TO service_role;
ALTER TABLE public.favorite_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorite clients" ON public.favorite_clients
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ceev_match_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contract_id uuid REFERENCES public.ceev_contracts(id) ON DELETE SET NULL,
  raw_label text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  note text,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ceev_match_log TO authenticated;
GRANT ALL ON public.ceev_match_log TO service_role;
ALTER TABLE public.ceev_match_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own ceev match log" ON public.ceev_match_log
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());