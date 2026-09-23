CREATE OR REPLACE FUNCTION public.is_approved_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id AND p.approval_status = 'approved'
    )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_member(uuid) FROM anon;

DROP POLICY IF EXISTS "Authenticated can read availabilities" ON public.sst_availability_calendar;
CREATE POLICY "Members can read availabilities"
  ON public.sst_availability_calendar FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read report history" ON public.intervention_report_history;
CREATE POLICY "Members read report history"
  ON public.intervention_report_history FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read all tasks" ON public.intervention_tasks;
CREATE POLICY "Members read all tasks"
  ON public.intervention_tasks FOR SELECT TO authenticated
  USING (public.is_approved_member(auth.uid()));