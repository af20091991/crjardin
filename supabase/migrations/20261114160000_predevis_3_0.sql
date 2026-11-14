-- Pré-devis 3.0 : archivage des devis, versions écartées, thèmes de travaux par poste.
-- Idempotente : peut être rejouée sans effet.

ALTER TABLE public.predevis_quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.predevis_quotes ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

ALTER TABLE public.predevis_postes ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.predevis_postes ADD COLUMN IF NOT EXISTS secondary_themes text[] NOT NULL DEFAULT '{}';
