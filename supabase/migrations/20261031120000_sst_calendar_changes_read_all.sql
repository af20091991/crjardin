-- Calendrier SST : tous les membres approuvés et les prestataires reliés à leur compte
-- voient tous les changements du calendrier (lecture seule).

DROP POLICY IF EXISTS "Members read all sst calendar changes" ON public.sst_calendar_changes;
CREATE POLICY "Members read all sst calendar changes"
  ON public.sst_calendar_changes FOR SELECT TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.auth_user_id = auth.uid() AND s.active = true
    )
  );
