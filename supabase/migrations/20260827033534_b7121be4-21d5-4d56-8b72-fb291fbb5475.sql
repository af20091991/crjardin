ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text,
  ADD COLUMN IF NOT EXISTS cr_notes text,
  ADD COLUMN IF NOT EXISTS ceev_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceev_planning_path text,
  ADD COLUMN IF NOT EXISTS ceev_planning_filename text,
  ADD COLUMN IF NOT EXISTS ceev_planning_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_client_type_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_client_type_check
      CHECK (client_type IS NULL OR client_type IN ('particulier', 'residence', 'professionnel'));
  END IF;
END $$;