-- Durcissement sécurité (idempotent) :
-- 1. app_appearance : lecture réservée aux membres approuvés (et admins), et non à tout compte créé.
-- 2. Fonctions SECURITY DEFINER qui ne doivent JAMAIS être appelées en anonyme (aucun appel anon
--    dans l'application ; les liens partagés, eux, restent à jeton et ne sont pas touchés).
--    Les fonctions utilisées par les politiques RLS et les triggers ne sont pas modifiées.

DROP POLICY IF EXISTS "Authenticated users read app appearance" ON public.app_appearance;
DROP POLICY IF EXISTS "Approved members read app appearance" ON public.app_appearance;
CREATE POLICY "Approved members read app appearance" ON public.app_appearance
  FOR SELECT
  TO authenticated
  USING (public.is_approved_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_user_emails() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_client_notification(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_view(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_ca_entry_to_client(uuid, uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pilot_classify_charges(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rebuild_recommendations_text(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_login(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_approval(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_share_access_log() FROM PUBLIC, anon;
