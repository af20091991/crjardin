
-- Phase 3B-3: personnalisation du compte-rendu
-- 1) Interventions : rédaction structurée + toggles de sections + métadonnées IA
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS positive_points text,
  ADD COLUMN IF NOT EXISTS attention_points text,
  ADD COLUMN IF NOT EXISTS garden_evolution text,
  ADD COLUMN IF NOT EXISTS report_sections jsonb NOT NULL DEFAULT jsonb_build_object(
    'summary', true,
    'worksite', true,
    'tasks', true,
    'positive_points', true,
    'attention_points', true,
    'garden_evolution', true,
    'garden_state', true,
    'recommendations', true,
    'upcoming', true,
    'photos', true
  ),
  ADD COLUMN IF NOT EXISTS ai_metadata jsonb;

-- 2) Recommandations : sélection + ordre + priorité + saison
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS recommended_season text,
  ADD COLUMN IF NOT EXISTS include_in_report boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS report_position integer;
