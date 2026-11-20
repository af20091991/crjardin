-- Ligne SST saisie dans les charges sans fiche de mission : décision explicite de
-- l'utilisateur (« pas de fiche, mais à comptabiliser »). Idempotent.
ALTER TABLE public.pilot_ca_entries DROP CONSTRAINT IF EXISTS pilot_ca_entries_match_status_check;
ALTER TABLE public.pilot_ca_entries ADD CONSTRAINT pilot_ca_entries_match_status_check
  CHECK (match_status = ANY (ARRAY['rattachee','creee','validation','non_identifie','en_attente','non_applicable','sans_fiche']));
