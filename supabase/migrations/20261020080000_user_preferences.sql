-- Personnalisation enregistrée sur le compte (au lieu de l'appareil).
-- Migration idempotente.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own preferences" ON public.user_preferences;
CREATE POLICY "Users read own preferences"
ON public.user_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;
CREATE POLICY "Users insert own preferences"
ON public.user_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own preferences" ON public.user_preferences;
CREATE POLICY "Users update own preferences"
ON public.user_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own preferences" ON public.user_preferences;
CREATE POLICY "Users delete own preferences"
ON public.user_preferences FOR DELETE TO authenticated
USING (user_id = auth.uid());
