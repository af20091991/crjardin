ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'a_valider',
  ADD COLUMN IF NOT EXISTS validation_note text,
  ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone;

ALTER TABLE public.pilot_ca_entries
  DROP CONSTRAINT IF EXISTS pilot_ca_entries_validation_status_check;

ALTER TABLE public.pilot_ca_entries
  ADD CONSTRAINT pilot_ca_entries_validation_status_check
  CHECK (validation_status IN ('a_valider', 'valide', 'a_revoir'));

CREATE INDEX IF NOT EXISTS pilot_ca_entries_validation_idx
  ON public.pilot_ca_entries (user_id, validation_status);