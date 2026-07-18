
-- Phase 1 — Consolidation architecture Pilotage
-- 1) Ajouter client_id sur pilot_ca_entries (source unique du CA), avec backfill par nom
ALTER TABLE public.pilot_ca_entries
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pilot_ca_entries_client_id
  ON public.pilot_ca_entries(client_id);

-- Backfill unique par correspondance de nom (case/espaces insensibles) — étape one-shot
UPDATE public.pilot_ca_entries pe
SET client_id = c.id
FROM public.clients c
WHERE pe.client_id IS NULL
  AND pe.user_id = c.user_id
  AND pe.designation IS NOT NULL
  AND lower(btrim(pe.designation)) = lower(btrim(c.name));

-- 2) Supprimer les tables doublons (vides)
DROP TABLE IF EXISTS public.pilot_entries;
DROP TABLE IF EXISTS public.pilot_objectives;

-- 3) Supprimer l'enum devenu inutilisé
DROP TYPE IF EXISTS public.pilot_family;
