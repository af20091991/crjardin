-- Temps de développement : journal des temps déclarés par Claude et les autres IA.
-- Chaque entrée est additionnée au total (app_dev_time.measured_seconds) par la route
-- /api/public/dev-time. Le temps d'utilisation de PP n'est plus compté.
CREATE TABLE IF NOT EXISTS public.dev_time_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  seconds integer NOT NULL CHECK (seconds > 0 AND seconds <= 86400),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  source text NOT NULL DEFAULT 'ia'
);

ALTER TABLE public.dev_time_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.dev_time_log TO authenticated;
GRANT ALL ON public.dev_time_log TO service_role;

DROP POLICY IF EXISTS "Authenticated read dev time log" ON public.dev_time_log;
CREATE POLICY "Authenticated read dev time log" ON public.dev_time_log
  FOR SELECT TO authenticated USING (true);

-- Le temps mesuré jusqu'ici provenait de l'utilisation de PP : il n'est pas du développement.
-- Remise à zéro : le total repart de la base de départ (695 h) et ne reçoit que les temps déclarés.
UPDATE public.app_dev_time SET measured_seconds = 0 WHERE id = 1;
