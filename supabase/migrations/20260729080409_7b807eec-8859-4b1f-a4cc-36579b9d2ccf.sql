ALTER TABLE public.subcontractor_missions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS prestation text,
  ADD COLUMN IF NOT EXISTS invoice_ref text,
  ADD COLUMN IF NOT EXISTS hours_saved numeric;

CREATE TABLE IF NOT EXISTS public.sst_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  value text NOT NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_lists TO authenticated;
GRANT ALL ON public.sst_lists TO service_role;
ALTER TABLE public.sst_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_lists_own" ON public.sst_lists FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER sst_lists_updated_at BEFORE UPDATE ON public.sst_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sst_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  label text,
  before_data jsonb,
  after_data jsonb,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_audit_log TO authenticated;
GRANT ALL ON public.sst_audit_log TO service_role;
ALTER TABLE public.sst_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_audit_own" ON public.sst_audit_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sst_audit_created ON public.sst_audit_log(user_id, created_at DESC);