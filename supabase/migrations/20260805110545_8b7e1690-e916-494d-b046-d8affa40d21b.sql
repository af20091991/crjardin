CREATE TABLE public.pilot_match_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  designation_key text NOT NULL,
  sample_designation text,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  hits integer NOT NULL DEFAULT 1,
  origin text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, designation_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_match_rules TO authenticated;
GRANT ALL ON public.pilot_match_rules TO service_role;
ALTER TABLE public.pilot_match_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own match rules" ON public.pilot_match_rules FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.client_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_client_id uuid NOT NULL,
  source_client_name text NOT NULL,
  target_client_id uuid NOT NULL,
  target_client_name text NOT NULL,
  moved jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_merge_log TO authenticated;
GRANT ALL ON public.client_merge_log TO service_role;
ALTER TABLE public.client_merge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own merge log" ON public.client_merge_log FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());