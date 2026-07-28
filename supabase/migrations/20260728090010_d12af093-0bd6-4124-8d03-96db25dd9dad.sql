ALTER TABLE public.pilot_ca_entries DROP CONSTRAINT pilot_ca_entries_match_status_check;
ALTER TABLE public.pilot_ca_entries ADD CONSTRAINT pilot_ca_entries_match_status_check CHECK (match_status = ANY (ARRAY['rattachee','creee','validation','non_identifie','en_attente','non_applicable']));

ALTER TABLE public.pilot_ca_entries ADD COLUMN IF NOT EXISTS sale_status text NOT NULL DEFAULT 'realise';
ALTER TABLE public.pilot_ca_entries DROP CONSTRAINT IF EXISTS pilot_ca_entries_sale_status_check;
ALTER TABLE public.pilot_ca_entries ADD CONSTRAINT pilot_ca_entries_sale_status_check CHECK (sale_status = ANY (ARRAY['planifie','realise','regle','particulier']));

UPDATE public.pilot_ca_entries
SET match_status = 'non_applicable', fiscal_tag = 'agregat_mensuel', match_method = 'agregat_historique', matched_at = now()
WHERE kind = 'vente' AND match_status = 'non_identifie' AND designation ILIKE 'Ventes HT %agrégat mensuel%';

UPDATE public.pilot_ca_entries
SET amount_ht = -1 * abs(amount_ht), match_status = 'non_applicable', fiscal_tag = 'remise_commerciale',
    designation = 'Remise commerciale (déduction de CA)', match_method = 'deduction_ca', matched_at = now()
WHERE id = 'e96350b3-b6ff-4f0b-bb0a-fcd332a5924e';