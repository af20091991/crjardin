-- Droits de table manquants pour l'application après migration hors Lovable.
-- Seul le rôle postgres avait des privilèges sur client_premium : les requêtes
-- des utilisateurs authentifiés échouaient avec « permission denied ».
-- Les politiques RLS existantes restent la barrière d'accès (administrateur uniquement).
-- Idempotent : GRANT peut être rejoué sans effet de bord.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_premium TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_premium_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_premium_work_calendar_items TO authenticated;

-- Le client serveur (service role) contourne RLS mais a besoin des droits de table.
GRANT ALL ON public.client_premium TO service_role;
GRANT ALL ON public.client_premium_documents TO service_role;
GRANT ALL ON public.client_premium_work_calendar_items TO service_role;
