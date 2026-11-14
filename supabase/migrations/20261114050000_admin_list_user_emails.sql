-- Gestion des rôles : adresse de connexion de chaque compte, visible uniquement par les admins.
CREATE OR REPLACE FUNCTION public.admin_list_user_emails()
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin')
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_emails() TO authenticated;
