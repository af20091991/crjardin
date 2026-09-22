DROP POLICY IF EXISTS "Authenticated can read calendar participants" ON public.calendar_participants;
CREATE POLICY "Approved team can read calendar participants"
ON public.calendar_participants
FOR SELECT
TO authenticated
USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read all recommendations" ON public.recommendations;
CREATE POLICY "Approved team can read recommendations"
ON public.recommendations
FOR SELECT
TO authenticated
USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read all photos" ON public.intervention_photos;
CREATE POLICY "Approved team can read intervention photos"
ON public.intervention_photos
FOR SELECT
TO authenticated
USING (public.is_approved_member(auth.uid()));