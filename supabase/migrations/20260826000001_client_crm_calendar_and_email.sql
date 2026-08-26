-- Client CRM persistence and private planning storage.
-- This migration is intentionally idempotent.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cr_notes TEXT,
  ADD COLUMN IF NOT EXISTS ceev_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceev_planning_path TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_filename TEXT,
  ADD COLUMN IF NOT EXISTS ceev_planning_updated_at TIMESTAMPTZ;

UPDATE public.clients
SET emails = CASE
  WHEN COALESCE(array_length(emails, 1), 0) > 0 THEN emails
  WHEN email IS NOT NULL AND btrim(email) <> '' THEN ARRAY[email]
  ELSE '{}'::text[]
END
WHERE COALESCE(array_length(emails, 1), 0) = 0;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-plannings', 'client-plannings', false, 15728640, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf']::text[];

NOTIFY pgrst, 'reload schema';
