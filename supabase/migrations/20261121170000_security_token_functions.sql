-- Sécurité (idempotent) :
-- 1. Fonctions de lien partagé (jeton) : plus exécutables par anon ni par authenticated.
--    L'application les appelle désormais côté serveur avec le service role (conservé).
--    Le jeton est toujours vérifié dans chaque fonction.
-- 2. Fonctions qui renvoient des données d'un utilisateur donné : retrait d'anon.
REVOKE EXECUTE ON FUNCTION public.get_shared_client(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shared_messages(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shared_notifications(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shared_premium(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shared_premium_document_url(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_shared_report_view(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_shared_read(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_shared_read(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_recommendations_viewed(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_gardener_messages_read(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_recommendation_interest(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_client_message(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_client_message_with_attachments(text, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_client_premium_document(text, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_subcontractor_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prestataire_client_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sst_calendar_recipients(text, uuid, uuid) FROM PUBLIC, anon;
