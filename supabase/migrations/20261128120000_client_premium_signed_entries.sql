-- Saisies client signées dans l'espace Premium (idempotent).
-- 1. Portrait du jardin modifiable par le client : une seule version, écrasée à chaque
--    modification ; la signature (nom saisi) et la date sont conservées.
--    Tant que garden_intro est NULL, l'affichage utilise la phrase d'origine (code).
-- 2. « Mes notes » : entrées signées, ajoutées uniquement (jamais modifiées ni écrasées).
-- Aucune écriture directe pour le client : toutes les saisies passent par des
-- fonctions serveur qui vérifient le jeton de partage (service role).

ALTER TABLE public.client_premium
  ADD COLUMN IF NOT EXISTS garden_intro text,
  ADD COLUMN IF NOT EXISTS garden_intro_signed_by text,
  ADD COLUMN IF NOT EXISTS garden_intro_signed_at timestamptz;

ALTER TABLE public.client_premium
  DROP CONSTRAINT IF EXISTS client_premium_garden_intro_length;
ALTER TABLE public.client_premium
  ADD CONSTRAINT client_premium_garden_intro_length
  CHECK (garden_intro IS NULL OR char_length(garden_intro) BETWEEN 1 AND 500);

CREATE TABLE IF NOT EXISTS public.client_premium_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  signed_by text NOT NULL CHECK (char_length(signed_by) BETWEEN 2 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_premium_notes_client_idx
  ON public.client_premium_notes (client_id, created_at DESC);

GRANT SELECT ON public.client_premium_notes TO authenticated;
GRANT ALL ON public.client_premium_notes TO service_role;

ALTER TABLE public.client_premium_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff lisent les notes Premium" ON public.client_premium_notes;
CREATE POLICY "Staff lisent les notes Premium"
  ON public.client_premium_notes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'observateur'::app_role)
  );
