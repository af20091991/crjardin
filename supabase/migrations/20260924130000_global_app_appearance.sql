-- Pilot Pro : apparence globale partagée entre tous les utilisateurs.
CREATE TABLE public.app_appearance (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.app_appearance TO authenticated;
GRANT ALL ON public.app_appearance TO service_role;

ALTER TABLE public.app_appearance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read app appearance"
  ON public.app_appearance
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins insert app appearance"
  ON public.app_appearance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update app appearance"
  ON public.app_appearance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
