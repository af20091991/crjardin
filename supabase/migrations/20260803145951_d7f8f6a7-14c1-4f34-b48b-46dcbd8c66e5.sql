ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS lost_at timestamptz;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_lifecycle_status_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_lifecycle_status_check
  CHECK (lifecycle_status IN ('actif','perdu'));