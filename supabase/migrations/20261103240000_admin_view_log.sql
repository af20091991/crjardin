-- Journal des consultations d'espaces clients par l'administrateur (Jardin Signature).
-- Lecture seule : aucune donnée client n'est modifiée. Chaque ouverture est tracée.
CREATE TABLE IF NOT EXISTS public.admin_view_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  surface text NOT NULL DEFAULT 'jardin_signature' CHECK (surface IN ('jardin_signature', 'pp'))
);

ALTER TABLE public.admin_view_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_view_log TO authenticated;
GRANT ALL ON public.admin_view_log TO service_role;

DROP POLICY IF EXISTS "Admins read admin view log" ON public.admin_view_log;
CREATE POLICY "Admins read admin view log" ON public.admin_view_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_admin_view(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  INSERT INTO public.admin_view_log (admin_user_id, client_id, surface)
  VALUES (auth.uid(), p_client_id, 'jardin_signature');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_admin_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_view(uuid) TO authenticated;
