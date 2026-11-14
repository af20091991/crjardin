-- Pré-devis : coût de sous-traitance saisi par poste, pour la rentabilité nette (SST inclus).
ALTER TABLE public.predevis_postes ADD COLUMN IF NOT EXISTS sst_cost_ht numeric(12,2);
