-- Final repair for the CR Chantier client/CEEV schema.
-- This migration is intentionally idempotent and also forces PostgREST to reload
-- its schema cache after the columns are created.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cr_notes TEXT,
  ADD COLUMN IF NOT EXISTS ceev_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceev_planning_path TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_filename TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_policy TEXT NOT NULL DEFAULT 'a_confirmer',
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_client_type_check
  CHECK (client_type IS NULL OR client_type IN ('particulier','residence','professionnel'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_report_policy_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_report_policy_check
  CHECK (report_policy IN ('oui','non','a_confirmer'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lifecycle_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_lifecycle_status_check
  CHECK (lifecycle_status IN ('actif','perdu'));

UPDATE public.clients
SET emails = CASE
  WHEN coalesce(array_length(emails, 1), 0) > 0 THEN emails
  WHEN email IS NOT NULL AND btrim(email) <> '' THEN ARRAY[email]
  ELSE '{}'::text[]
END
WHERE emails IS NULL OR coalesce(array_length(emails, 1), 0) = 0;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-plannings', 'client-plannings', false, 15728640, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf']::text[];

NOTIFY pgrst, 'reload schema';
