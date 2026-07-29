CREATE TABLE public.pilot_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL,
  entity_id uuid,
  label text,
  field text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_edit_log TO authenticated;
GRANT ALL ON public.pilot_edit_log TO service_role;
ALTER TABLE public.pilot_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pilot_edit_log" ON public.pilot_edit_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX pilot_edit_log_entity_idx ON public.pilot_edit_log (user_id, entity, created_at DESC);

CREATE TABLE public.pilot_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  year integer NOT NULL,
  app_version text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_metric_snapshots TO authenticated;
GRANT ALL ON public.pilot_metric_snapshots TO service_role;
ALTER TABLE public.pilot_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pilot_metric_snapshots" ON public.pilot_metric_snapshots FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX pilot_metric_snapshots_idx ON public.pilot_metric_snapshots (user_id, year, created_at DESC);