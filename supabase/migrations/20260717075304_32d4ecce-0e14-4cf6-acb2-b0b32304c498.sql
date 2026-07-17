
ALTER TABLE public.pilot_ca_entries ADD COLUMN IF NOT EXISTS note text;

CREATE TABLE IF NOT EXISTS public.pilot_client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_key text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_client_notes TO authenticated;
GRANT ALL ON public.pilot_client_notes TO service_role;

ALTER TABLE public.pilot_client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own pilot client notes" ON public.pilot_client_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_client_notes_updated_at
  BEFORE UPDATE ON public.pilot_client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
