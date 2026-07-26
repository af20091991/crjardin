ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS match_score numeric,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

ALTER TABLE public.pilot_ca_entries DROP CONSTRAINT IF EXISTS pilot_ca_entries_match_status_check;
ALTER TABLE public.pilot_ca_entries ADD CONSTRAINT pilot_ca_entries_match_status_check
  CHECK (match_status IN ('rattachee','creee','validation','non_identifie','en_attente'));

CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_match_status ON public.pilot_ca_entries(match_status);

UPDATE public.pilot_ca_entries
   SET match_status = 'rattachee',
       match_score = COALESCE(match_score, 100),
       match_method = COALESCE(match_method, 'historique_valide'),
       matched_at = COALESCE(matched_at, updated_at)
 WHERE client_id IS NOT NULL AND match_status = 'en_attente';