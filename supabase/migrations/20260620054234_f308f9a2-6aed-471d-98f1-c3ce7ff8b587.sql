-- 1. Admin role for the owner account, now and on future signup
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'fournier.anthony2009@gmail.com'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  IF NEW.email = 'fournier.anthony2009@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Client read tracking on interventions ("Lu" status)
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS client_read_at timestamptz;
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS client_read_count integer NOT NULL DEFAULT 0;

-- 3. Access log (who/when consulted the share link) - for admin supervision
CREATE TABLE IF NOT EXISTS public.share_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);
GRANT SELECT ON public.share_access_log TO authenticated;
GRANT ALL ON public.share_access_log TO service_role;
ALTER TABLE public.share_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read access log" ON public.share_access_log FOR SELECT TO authenticated USING (true);

-- 4. Client messages (annotations / questions submitted from the share link)
CREATE TABLE IF NOT EXISTS public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'annotation',
  content text NOT NULL,
  author_name text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.client_messages TO authenticated;
GRANT ALL ON public.client_messages TO service_role;
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read client messages" ON public.client_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update client messages" ON public.client_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owner or admin delete client messages" ON public.client_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));

-- 5. In-app notifications for internal users
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  client_id uuid,
  intervention_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. RPC: record a client read of the share link
CREATE OR REPLACE FUNCTION public.mark_shared_read(p_token text, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_iv RECORD;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.share_access_log (client_id, user_agent) VALUES (v_client.id, p_user_agent);

  FOR v_iv IN
    SELECT id, user_id, title, reference, client_read_count
    FROM public.interventions
    WHERE client_id = v_client.id AND status = 'termine'
  LOOP
    IF v_iv.client_read_count = 0 THEN
      INSERT INTO public.notifications (user_id, type, title, body, client_id, intervention_id)
      VALUES (v_iv.user_id, 'read',
        v_client.name || ' a consulté un compte-rendu',
        COALESCE(v_iv.title, v_iv.reference, 'Compte-rendu') || ' a été lu par le client.',
        v_client.id, v_iv.id);
    END IF;
    UPDATE public.interventions
    SET client_read_at = now(), client_read_count = client_read_count + 1
    WHERE id = v_iv.id;
  END LOOP;
END;
$function$;

-- 7. RPC: client posts an annotation or question from the share link
CREATE OR REPLACE FUNCTION public.add_client_message(
  p_token text, p_intervention_id uuid, p_kind text, p_content text, p_author_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_owner uuid;
  v_msg_id uuid;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Lien invalide'; END IF;
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN RAISE EXCEPTION 'Message vide'; END IF;

  -- determine recipient: intervention owner if provided, else client owner
  IF p_intervention_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.interventions WHERE id = p_intervention_id AND client_id = v_client.id;
  END IF;
  v_owner := COALESCE(v_owner, v_client.user_id);

  INSERT INTO public.client_messages (client_id, intervention_id, kind, content, author_name)
  VALUES (v_client.id, p_intervention_id,
          CASE WHEN p_kind = 'question' THEN 'question' ELSE 'annotation' END,
          left(trim(p_content), 2000), p_author_name)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications (user_id, type, title, body, client_id, intervention_id)
  VALUES (v_owner,
    CASE WHEN p_kind = 'question' THEN 'question' ELSE 'annotation' END,
    v_client.name || (CASE WHEN p_kind = 'question' THEN ' a posé une question' ELSE ' a ajouté une annotation' END),
    left(trim(p_content), 300), v_client.id, p_intervention_id);

  RETURN v_msg_id;
END;
$function$;

-- 8. RPC: fetch client messages for the share link (so the client sees their own thread)
CREATE OR REPLACE FUNCTION public.get_shared_messages(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'intervention_id', m.intervention_id, 'kind', m.kind,
      'content', m.content, 'author_name', m.author_name, 'created_at', m.created_at
    ) ORDER BY m.created_at ASC)
    FROM public.client_messages m WHERE m.client_id = v_client.id
  ), '[]'::jsonb);
END;
$function$;