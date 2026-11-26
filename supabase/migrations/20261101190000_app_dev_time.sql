-- Compteur de temps de développement : total de base + temps réel mesuré dans l'app (admin).
CREATE TABLE IF NOT EXISTS public.app_dev_time (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_hours NUMERIC NOT NULL DEFAULT 695,
  measured_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_dev_time (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.app_dev_time TO authenticated;
ALTER TABLE public.app_dev_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read dev time" ON public.app_dev_time
  FOR SELECT TO authenticated USING (true);

-- Ajoute des secondes mesurées (plafonnées à 120 s par appel), réservé à l'admin.
CREATE OR REPLACE FUNCTION public.add_dev_time(p_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_row public.app_dev_time;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.app_dev_time
    SET measured_seconds = measured_seconds + LEAST(GREATEST(p_seconds, 0), 120),
        updated_at = now()
    WHERE id = 1
    RETURNING * INTO v_row;
  RETURN jsonb_build_object('base_hours', v_row.base_hours, 'measured_seconds', v_row.measured_seconds);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.add_dev_time(integer) TO authenticated;
