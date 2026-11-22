-- Tables présentes en production mais jamais versionnées dans le dépôt.
-- Reconstruites à l'identique depuis la base de production. Idempotent.

-- Pièces jointes des messages client
CREATE TABLE IF NOT EXISTS public.client_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.client_messages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_message_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Editors add gardener attachments" ON public.client_message_attachments;
DROP POLICY IF EXISTS "Editors add gardener attachments" ON public.client_message_attachments;
CREATE POLICY "Editors add gardener attachments" ON public.client_message_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()) AND uploaded_by = 'gardener');
DROP POLICY IF EXISTS "Editors delete chat attachments" ON public.client_message_attachments;
DROP POLICY IF EXISTS "Editors delete chat attachments" ON public.client_message_attachments;
CREATE POLICY "Editors delete chat attachments" ON public.client_message_attachments FOR DELETE TO authenticated
  USING (public.is_editor(auth.uid()));
DROP POLICY IF EXISTS "Read chat attachments like messages" ON public.client_message_attachments;
DROP POLICY IF EXISTS "Read chat attachments like messages" ON public.client_message_attachments;
CREATE POLICY "Read chat attachments like messages" ON public.client_message_attachments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'observateur'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_message_attachments.client_id AND c.user_id = auth.uid())
  );

-- Journal d'envoi des e-mails (service d'envoi)
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending','sent','suppressed','failed','bounced','complained','dlq'])),
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_send_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until timestamptz,
  batch_size integer NOT NULL DEFAULT 10,
  send_delay_ms integer NOT NULL DEFAULT 200,
  auth_email_ttl_minutes integer NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason = ANY (ARRAY['unsubscribe','bounce','complaint'])),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_send_log','email_send_state','email_unsubscribe_tokens','suppressed_emails'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Service role manage ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', 'Service role manage ' || t, t);
  END LOOP;
END $$;

-- Veille Site web : éléments suivis par utilisateur
CREATE TABLE IF NOT EXISTS public.site_web_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['query','page'])),
  entity_key text NOT NULL,
  status text NOT NULL DEFAULT 'a_traiter' CHECK (status = ANY (ARRAY['a_traiter','en_cours','traite','ignore'])),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_key)
);
ALTER TABLE public.site_web_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_web_watchlist_select_own ON public.site_web_watchlist;
DROP POLICY IF EXISTS site_web_watchlist_select_own ON public.site_web_watchlist;
CREATE POLICY site_web_watchlist_select_own ON public.site_web_watchlist FOR SELECT TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS site_web_watchlist_insert_own ON public.site_web_watchlist;
DROP POLICY IF EXISTS site_web_watchlist_insert_own ON public.site_web_watchlist;
CREATE POLICY site_web_watchlist_insert_own ON public.site_web_watchlist FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS site_web_watchlist_update_own ON public.site_web_watchlist;
DROP POLICY IF EXISTS site_web_watchlist_update_own ON public.site_web_watchlist;
CREATE POLICY site_web_watchlist_update_own ON public.site_web_watchlist FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS site_web_watchlist_delete_own ON public.site_web_watchlist;
DROP POLICY IF EXISTS site_web_watchlist_delete_own ON public.site_web_watchlist;
CREATE POLICY site_web_watchlist_delete_own ON public.site_web_watchlist FOR DELETE TO public USING (auth.uid() = user_id);
