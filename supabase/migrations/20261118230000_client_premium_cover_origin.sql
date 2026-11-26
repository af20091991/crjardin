-- Couverture Premium : on garde qui a choisi la photo.
-- Si le client l'a choisie (cover_set_by = 'client'), le jardinier doit confirmer avant de la remplacer.
BEGIN;

ALTER TABLE public.client_premium
  ADD COLUMN IF NOT EXISTS cover_set_by text
    CHECK (cover_set_by IN ('client', 'gardener')),
  ADD COLUMN IF NOT EXISTS cover_set_at timestamptz;

COMMIT;
