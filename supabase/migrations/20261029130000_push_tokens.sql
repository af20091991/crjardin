-- Notifications push (Firebase Cloud Messaging) : jetons des téléphones + envoi à chaque
-- nouvelle notification. L'endpoint /api/public/push-dispatch ne lit que des données déjà
-- en base et ne pousse chaque notification qu'une seule fois (push_sent_at).

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own push tokens" ON public.push_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own push tokens" ON public.push_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own push tokens" ON public.push_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own push tokens" ON public.push_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.push_tokens t WHERE t.user_id = NEW.user_id) THEN
    PERFORM net.http_post(
      url := 'https://crjardin.lovable.app/api/public/push-dispatch',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('notification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'une notification à cause du push.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push_dispatch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifications_push ON public.notifications;
CREATE TRIGGER trg_notifications_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_dispatch();
