-- Nouveau module Calendrier SST : calendrier partagé de disponibilités
CREATE TABLE IF NOT EXISTS public.sst_availability_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  date date NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sst_availability_calendar_unique UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_availability_calendar TO authenticated;
GRANT ALL ON public.sst_availability_calendar TO service_role;

ALTER TABLE public.sst_availability_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read availabilities" ON public.sst_availability_calendar;
CREATE POLICY "Authenticated can read availabilities" ON public.sst_availability_calendar FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own availability" ON public.sst_availability_calendar;
CREATE POLICY "Users insert own availability" ON public.sst_availability_calendar FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own availability" ON public.sst_availability_calendar;
CREATE POLICY "Users update own availability" ON public.sst_availability_calendar FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own availability" ON public.sst_availability_calendar;
CREATE POLICY "Users delete own availability" ON public.sst_availability_calendar FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins delete any availability" ON public.sst_availability_calendar;
CREATE POLICY "Admins delete any availability" ON public.sst_availability_calendar FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS sst_availability_calendar_date_idx ON public.sst_availability_calendar (date);

CREATE TRIGGER sst_availability_calendar_updated_at
  BEFORE UPDATE ON public.sst_availability_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppression de l'ancien module complexe (aucune dépendance ailleurs dans PP)
DROP TABLE IF EXISTS public.sst_calendar_conflicts CASCADE;
DROP TABLE IF EXISTS public.sst_availability_request_targets CASCADE;
DROP TABLE IF EXISTS public.sst_availability_requests CASCADE;
DROP TABLE IF EXISTS public.sst_intervention_assignments CASCADE;
DROP TABLE IF EXISTS public.sst_availabilities CASCADE;
DROP TABLE IF EXISTS public.sst_calendar_settings CASCADE;
DROP TABLE IF EXISTS public.sst_calendar_audit_log CASCADE;
DROP TABLE IF EXISTS public.sst_user_links CASCADE;

DROP FUNCTION IF EXISTS public.enforce_sst_target_response_update() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_sst_assignment_response_update() CASCADE;
DROP FUNCTION IF EXISTS public.is_linked_to_subcontractor(uuid, uuid) CASCADE;