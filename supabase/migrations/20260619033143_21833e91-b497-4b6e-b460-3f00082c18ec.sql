-- 1. Shared visibility: all authenticated users can READ everything,
--    but only the owner can modify their own entries.

-- clients
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Authenticated read all clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- interventions
DROP POLICY IF EXISTS "Users manage own interventions" ON public.interventions;
CREATE POLICY "Authenticated read all interventions" ON public.interventions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert interventions" ON public.interventions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update interventions" ON public.interventions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete interventions" ON public.interventions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- intervention_tasks
DROP POLICY IF EXISTS "Users manage own tasks" ON public.intervention_tasks;
CREATE POLICY "Authenticated read all tasks" ON public.intervention_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert tasks" ON public.intervention_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update tasks" ON public.intervention_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete tasks" ON public.intervention_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- intervention_photos
DROP POLICY IF EXISTS "Users manage own photos" ON public.intervention_photos;
CREATE POLICY "Authenticated read all photos" ON public.intervention_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert photos" ON public.intervention_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update photos" ON public.intervention_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete photos" ON public.intervention_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- recommendations
DROP POLICY IF EXISTS "Users manage own recommendations" ON public.recommendations;
CREATE POLICY "Authenticated read all recommendations" ON public.recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert recommendations" ON public.recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update recommendations" ON public.recommendations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete recommendations" ON public.recommendations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- garden_health
DROP POLICY IF EXISTS "Users manage own garden health" ON public.garden_health;
CREATE POLICY "Authenticated read all garden health" ON public.garden_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert garden health" ON public.garden_health FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update garden health" ON public.garden_health FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete garden health" ON public.garden_health FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles: readable by all authenticated (author names/signatures), editable by owner only
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Authenticated read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Secret share token for client view links
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS share_token text;
UPDATE public.clients SET share_token = replace(gen_random_uuid()::text, '-', '') WHERE share_token IS NULL;
ALTER TABLE public.clients ALTER COLUMN share_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE public.clients ALTER COLUMN share_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_share_token_key ON public.clients (share_token);

-- 3. Public read function for the client share link (bypasses RLS, token-gated)
CREATE OR REPLACE FUNCTION public.get_shared_client(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clients;
  result jsonb;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN
    RETURN NULL;
  END IF;
  result := jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'address', v_client.address,
      'phone', v_client.phone,
      'email', v_client.email,
      'contract_type', v_client.contract_type,
      'frequency', v_client.frequency
    ),
    'interventions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'reference', i.reference,
        'intervention_date', i.intervention_date,
        'intervention_type', i.intervention_type,
        'summary', i.summary,
        'garden_state', i.garden_state,
        'upcoming_works', i.upcoming_works,
        'recommendations_text', i.recommendations_text,
        'tasks', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'status', t.status, 'note', t.note) ORDER BY t.position)
          FROM public.intervention_tasks t WHERE t.intervention_id = i.id
        ), '[]'::jsonb),
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', p.id, 'storage_path', p.storage_path, 'caption', p.caption) ORDER BY p.position)
          FROM public.intervention_photos p WHERE p.intervention_id = i.id AND p.include_in_report = true
        ), '[]'::jsonb)
      ) ORDER BY i.intervention_date DESC)
      FROM public.interventions i
      WHERE i.client_id = v_client.id AND i.status = 'termine'
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_client(text) TO anon, authenticated;