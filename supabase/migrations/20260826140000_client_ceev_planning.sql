-- CEEV client planning document
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS cr_notes TEXT,
  ADD COLUMN IF NOT EXISTS ceev_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceev_planning_path TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_filename TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS report_policy TEXT NOT NULL DEFAULT 'a_confirmer',
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_client_type_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_client_type_check
      CHECK (client_type IS NULL OR client_type IN ('particulier','residence','professionnel'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_report_policy_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_report_policy_check
      CHECK (report_policy IN ('oui','non','a_confirmer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_lifecycle_status_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_lifecycle_status_check
      CHECK (lifecycle_status IN ('actif','perdu'));
  END IF;
END $$;

UPDATE public.clients
SET emails = CASE
  WHEN email IS NULL OR btrim(email) = '' THEN '{}'
  ELSE ARRAY[email]
END
WHERE emails = '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-plannings', 'client-plannings', false, 15728640, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf']::text[];
