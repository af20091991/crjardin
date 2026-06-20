
-- 1. Gardener replies on client messages
ALTER TABLE public.client_messages ADD COLUMN IF NOT EXISTS sender text NOT NULL DEFAULT 'client';

CREATE POLICY "Owner insert client messages"
ON public.client_messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_messages.client_id AND c.user_id = auth.uid())
);

-- include sender in shared messages output
CREATE OR REPLACE FUNCTION public.get_shared_messages(p_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'intervention_id', m.intervention_id, 'kind', m.kind,
      'content', m.content, 'author_name', m.author_name, 'sender', m.sender, 'created_at', m.created_at
    ) ORDER BY m.created_at ASC)
    FROM public.client_messages m WHERE m.client_id = v_client.id
  ), '[]'::jsonb);
END;
$function$;

-- 2. Client interest on recommendations
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS client_interest text;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS client_interest_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_recommendation_interest(p_token text, p_reco_id uuid, p_interest text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients; v_reco public.recommendations;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Lien invalide'; END IF;
  IF p_interest NOT IN ('interested','not_interested') THEN RAISE EXCEPTION 'Choix invalide'; END IF;
  SELECT * INTO v_reco FROM public.recommendations WHERE id = p_reco_id AND client_id = v_client.id;
  IF v_reco.id IS NULL THEN RAISE EXCEPTION 'Préconisation introuvable'; END IF;

  UPDATE public.recommendations
    SET client_interest = p_interest, client_interest_at = now()
  WHERE id = p_reco_id;

  INSERT INTO public.notifications (user_id, type, title, body, client_id)
  VALUES (v_reco.user_id, 'question',
    v_client.name || (CASE WHEN p_interest = 'interested' THEN ' est intéressé(e) par une préconisation' ELSE ' a décliné une préconisation' END),
    v_reco.title, v_client.id);
END;
$function$;

-- expose recommendations + last visit in shared client payload
CREATE OR REPLACE FUNCTION public.get_shared_client(p_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client public.clients; result jsonb;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RETURN NULL; END IF;
  result := jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id, 'name', v_client.name, 'address', v_client.address,
      'phone', v_client.phone, 'email', v_client.email,
      'contract_type', v_client.contract_type, 'frequency', v_client.frequency
    ),
    'recommendations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'description', r.description, 'category', r.category,
        'status', r.status, 'estimated_hours', r.estimated_hours, 'unit_price', r.unit_price,
        'client_interest', r.client_interest
      ) ORDER BY r.created_at DESC)
      FROM public.recommendations r
      WHERE r.client_id = v_client.id AND r.status IN ('en_attente','acceptee')
    ), '[]'::jsonb),
    'interventions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'reference', i.reference,
        'intervention_date', i.intervention_date, 'intervention_type', i.intervention_type,
        'summary', i.summary, 'garden_state', i.garden_state, 'upcoming_works', i.upcoming_works,
        'recommendations_text', i.recommendations_text, 'client_read_at', i.client_read_at,
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
$function$;

-- 3. Photo geolocation
ALTER TABLE public.intervention_photos ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.intervention_photos ADD COLUMN IF NOT EXISTS lng double precision;

-- 4. Reminders / planned tasks for gardener
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage reminders" ON public.reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Report templates for gardener
CREATE TABLE public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  intervention_type text,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage templates" ON public.report_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
