-- Normalisation statut intervention: "termine" -> "terminee"
UPDATE public.interventions SET status = 'terminee' WHERE status = 'termine';
ALTER TABLE public.interventions ALTER COLUMN status SET DEFAULT 'brouillon';