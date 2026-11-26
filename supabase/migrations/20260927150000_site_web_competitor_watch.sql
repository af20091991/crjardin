-- Site web module : veille concurrentielle basée sur des mesures techniques
-- gratuites (Google PageSpeed Insights + vérification SSL + temps de réponse)
-- sur des concurrents choisis manuellement.

CREATE TABLE IF NOT EXISTS public.site_web_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_web_competitor_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES public.site_web_competitors(id) ON DELETE CASCADE,
  performance_score integer,
  seo_score integer,
  accessibility_score integer,
  best_practices_score integer,
  ssl_ok boolean NOT NULL DEFAULT false,
  response_time_ms integer,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_web_competitor_checks_competitor_idx
  ON public.site_web_competitor_checks (competitor_id, checked_at DESC);

GRANT SELECT, INSERT, DELETE ON public.site_web_competitors TO authenticated;
GRANT ALL ON public.site_web_competitors TO service_role;
GRANT SELECT ON public.site_web_competitor_checks TO authenticated;
GRANT ALL ON public.site_web_competitor_checks TO service_role;

ALTER TABLE public.site_web_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_web_competitor_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage competitors"
  ON public.site_web_competitors
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users read competitor checks"
  ON public.site_web_competitor_checks
  FOR SELECT
  TO authenticated
  USING (true);
