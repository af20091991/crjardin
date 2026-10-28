-- Correctif SST ciblé : autorisations de lecture limitées aux missions attribuées
-- et notifications du calendrier aux prestataires actifs reliés à leur compte.
-- Ne change pas les autorisations d'écriture ni les autres modules.

-- Calendrier partagé : autoriser les prestataires actifs même s'ils n'ont pas de rôle interne.
DROP POLICY IF EXISTS "Active subcontractors read SST availability" ON public.sst_availability_calendar;
CREATE POLICY "Active subcontractors read SST availability"
  ON public.sst_availability_calendar FOR SELECT TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.user_id = auth.uid() AND s.active = true
    )
  );

-- Lecture seule des missions assignées au prestataire connecté.
DROP POLICY IF EXISTS "Assigned subcontractors read own missions" ON public.subcontractor_missions;
CREATE POLICY "Assigned subcontractors read own missions"
  ON public.subcontractor_missions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id = subcontractor_missions.subcontractor_id
        AND s.user_id = auth.uid() AND s.active = true
    )
  );

-- Lecture seule des fiches de chantier explicitement liées à ses missions.
DROP POLICY IF EXISTS "Assigned subcontractors read linked worksite sheets" ON public.worksite_sheets;
CREATE POLICY "Assigned subcontractors read linked worksite sheets"
  ON public.worksite_sheets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.worksite_sheet_id = worksite_sheets.id
        AND s.user_id = auth.uid() AND s.active = true
    )
  );

-- Lecture seule des photos des missions qui lui sont attribuées.
DROP POLICY IF EXISTS "Assigned subcontractors read own mission photos" ON public.subcontractor_mission_photos;
CREATE POLICY "Assigned subcontractors read own mission photos"
  ON public.subcontractor_mission_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.id = subcontractor_mission_photos.mission_id
        AND s.user_id = auth.uid() AND s.active = true
    )
  );

-- Inclure les prestataires actifs dans les notifications des disponibilités partagées,
-- sans les obliger à posséder un rôle interne dans user_roles.
CREATE OR REPLACE FUNCTION public.sst_calendar_recipients(p_entity text, p_owner uuid, p_actor uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.user_id
  FROM public.user_roles r
  WHERE r.user_id IS DISTINCT FROM p_actor
    AND (
      p_entity = 'availability'
      OR r.role = 'admin'
      OR r.user_id = p_owner
    )
  UNION
  SELECT s.user_id
  FROM public.subcontractors s
  WHERE s.active = true
    AND s.user_id IS DISTINCT FROM p_actor
    AND p_entity = 'availability'
  UNION
  SELECT p_owner
  WHERE p_entity = 'worksite'
    AND p_owner IS NOT NULL
    AND p_owner IS DISTINCT FROM p_actor;
$$;

-- Les prestataires assignés à une fiche SST reçoivent aussi les notifications de cette fiche.
-- Cette fonction utilise l'ID réel de la fiche conservé dans sst_calendar_changes.entity_id,
-- sans modifier le déclencheur existant ni son journal détaillé.
CREATE OR REPLACE FUNCTION public.sst_notify_assigned_subcontractors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity <> 'worksite' OR NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT DISTINCT s.user_id, 'sst_calendar', NEW.summary,
         NULLIF(
           (SELECT string_agg(
              CASE WHEN d->>'from' IS NULL AND d->>'to' IS NULL THEN d->>'label'
                   ELSE (d->>'label') || ' : ' || COALESCE(d->>'from', '—') || ' → ' || COALESCE(d->>'to', '—') END,
              ' · ')
            FROM jsonb_array_elements(COALESCE(NEW.details, '[]'::jsonb)) d),
           '')
  FROM public.subcontractor_missions m
  JOIN public.subcontractors s ON s.id = m.subcontractor_id
  WHERE m.worksite_sheet_id = NEW.entity_id
    AND s.active = true
    AND s.user_id IS DISTINCT FROM NEW.actor_id
    AND s.user_id IS DISTINCT FROM NEW.owner_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = s.user_id AND r.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'sst_calendar'
        AND n.title = NEW.summary
        AND n.created_at >= NEW.created_at - interval '3 seconds'
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sst_notify_assigned_subcontractors ON public.sst_calendar_changes;
CREATE TRIGGER sst_notify_assigned_subcontractors
  AFTER INSERT ON public.sst_calendar_changes
  FOR EACH ROW EXECUTE FUNCTION public.sst_notify_assigned_subcontractors();
