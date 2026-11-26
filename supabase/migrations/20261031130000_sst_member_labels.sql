-- Calendrier SST : afficher le nom du prestataire (fiche sous-traitant liée au compte)
-- au lieu de « Utilisateur PP ». Les profils ne sont lisibles que par leur propriétaire
-- et les admins ; cette fonction ne renvoie que l'identifiant et le libellé, aux membres approuvés
-- et aux prestataires actifs.

CREATE OR REPLACE FUNCTION public.sst_member_labels(p_ids uuid[])
RETURNS TABLE (id uuid, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(
           NULLIF(btrim(s.name), ''),
           NULLIF(btrim(p.display_name), ''),
           NULLIF(btrim(p.company_name), '')
         ) AS label
  FROM public.profiles p
  LEFT JOIN public.subcontractors s
    ON s.auth_user_id = p.id AND s.active = true
  WHERE p.id = ANY(p_ids)
    AND (
      public.is_approved_member(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.subcontractors x
        WHERE x.auth_user_id = auth.uid() AND x.active = true
      )
    );
$$;

REVOKE ALL ON FUNCTION public.sst_member_labels(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sst_member_labels(uuid[]) TO authenticated;
