-- Sécurité Site web : les fonctions SECURITY DEFINER manipulant les jetons Google
-- n'effectuent aucun contrôle d'identité ; elles ne doivent être appelables que par
-- la fonction Edge (service_role). Les tables de connexion ne sont plus modifiables
-- par les utilisateurs : tout passe par la fonction Edge. Migration idempotente.
REVOKE ALL ON FUNCTION public.get_site_web_google_tokens(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_site_web_google_tokens(uuid, text, text, text, timestamptz, text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_site_web_oauth_state(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_web_google_tokens(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_site_web_google_tokens(uuid, text, text, text, timestamptz, text, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_site_web_oauth_state(text, uuid, text) TO service_role;

REVOKE ALL ON public.site_web_oauth_states FROM anon, authenticated;
GRANT ALL ON public.site_web_oauth_states TO service_role;

REVOKE ALL ON public.site_web_connections FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.site_web_connections FROM authenticated;
GRANT SELECT ON public.site_web_connections TO authenticated;
GRANT ALL ON public.site_web_connections TO service_role;

REVOKE ALL ON public.site_web_watchlist, public.site_web_competitors, public.site_web_competitor_checks FROM anon;
