-- Veille concurrentielle : détail structuré de chaque analyse (métriques PageSpeed,
-- SEO de la page d'accueil, technique, activité éditoriale, points faibles).
ALTER TABLE public.site_web_competitor_checks
  ADD COLUMN IF NOT EXISTS details jsonb;
