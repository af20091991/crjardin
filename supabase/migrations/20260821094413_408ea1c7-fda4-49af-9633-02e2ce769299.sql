ALTER TABLE public.pilot_ca_entries ADD COLUMN IF NOT EXISTS net_amount_ht numeric;

ALTER TABLE public.pilot_fixed_charges
  ADD COLUMN IF NOT EXISTS ca_entry_id uuid REFERENCES public.pilot_ca_entries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS pilot_fixed_charges_ca_entry_id_idx
  ON public.pilot_fixed_charges(ca_entry_id);

-- Rattachement du détail existant (12 postes 2026) à la ligne « Charges fixes » d'août 2026
UPDATE public.pilot_fixed_charges
   SET ca_entry_id = '4e46318f-1ed0-46cb-b455-02f4ebe728f5'
 WHERE year = 2026 AND ca_entry_id IS NULL;

UPDATE public.pilot_ca_entries
   SET is_fixed = true,
       designation = 'Charges fixes',
       amount_ht = 725.72,
       position = 0
 WHERE id = '4e46318f-1ed0-46cb-b455-02f4ebe728f5';

-- Majoration (net + 45 %) à partir d'août 2026 uniquement, net conservé à part
UPDATE public.pilot_ca_entries
   SET net_amount_ht = amount_ht,
       amount_ht = round(amount_ht * 1.45, 2)
 WHERE kind = 'remuneration'
   AND net_amount_ht IS NULL
   AND (year > 2026 OR (year = 2026 AND month >= 8));