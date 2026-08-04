ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS entity_status text NOT NULL DEFAULT 'manual_review_required',
  ADD COLUMN IF NOT EXISTS entity_confidence integer,
  ADD COLUMN IF NOT EXISTS entity_status_source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS suggested_entity_name text,
  ADD COLUMN IF NOT EXISTS entity_notes text,
  ADD COLUMN IF NOT EXISTS entity_certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS entity_certified_by uuid;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_entity_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_entity_status_check
  CHECK (entity_status IN ('certified_client','probable_client','probable_contact','duplicate_candidate','manual_review_required'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_entity_status_source_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_entity_status_source_check
  CHECK (entity_status_source IN ('auto','manuel'));

CREATE TABLE IF NOT EXISTS public.referential_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ca_impacted numeric,
  hours_impacted numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.referential_audit_log TO authenticated;
GRANT ALL ON public.referential_audit_log TO service_role;
ALTER TABLE public.referential_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read referential audit log"
  ON public.referential_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can append referential audit log"
  ON public.referential_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS referential_audit_log_client_idx ON public.referential_audit_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clients_entity_status_idx ON public.clients(entity_status);