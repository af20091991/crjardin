-- Liaisons supplémentaires utilisateur -> prestataire (vue cumulée).
-- Ne modifie aucune politique existante : la table et la fonction sont ajoutées,
-- les règles existantes restent inchangées tant qu'elles ne les utilisent pas.

CREATE TABLE IF NOT EXISTS public.subcontractor_extra_links (
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_user_id, subcontractor_id)
);

ALTER TABLE public.subcontractor_extra_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subcontractor_extra_links FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.auth_subcontractor_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM public.subcontractors s WHERE s.auth_user_id = _user_id
  UNION
  SELECT l.subcontractor_id FROM public.subcontractor_extra_links l WHERE l.auth_user_id = _user_id
$$;

REVOKE ALL ON FUNCTION public.auth_subcontractor_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_subcontractor_ids(uuid) TO authenticated;

-- Compte commercial@delagraineaujardin.com : vue cumulée Chloé + Fanny
INSERT INTO public.subcontractor_extra_links (auth_user_id, subcontractor_id) VALUES
  ('9114e931-9283-405c-ba23-12f872b31c0b', 'b068eca5-e7f9-4de4-a84c-f85aa21b238b'),
  ('9114e931-9283-405c-ba23-12f872b31c0b', 'ebe0a4dc-5904-4902-882b-5894ca8a0d8d')
ON CONFLICT DO NOTHING;
