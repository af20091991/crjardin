-- Site web module: cache for Semrush reports.
-- Semrush API calls consume paid units, so results are cached server-side
-- (edge function "semrush-api") instead of being fetched on every page view.

CREATE TABLE IF NOT EXISTS public.site_web_semrush_cache (
  report_type text NOT NULL,
  domain text NOT NULL,
  database text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_type, domain, database)
);

GRANT SELECT ON public.site_web_semrush_cache TO authenticated;
GRANT ALL ON public.site_web_semrush_cache TO service_role;

ALTER TABLE public.site_web_semrush_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read Semrush cache"
  ON public.site_web_semrush_cache
  FOR SELECT
  TO authenticated
  USING (true);
