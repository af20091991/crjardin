-- Correctif ciblé SST pour les prestataires externes liés à un compte PP.
-- Accès en lecture uniquement aux missions/fiches qui leur sont assignées.
-- Les utilisateurs internes et leurs politiques existantes restent inchangés.

-- 1) Le calendrier partagé est accessible aux prestataires actifs liés à leur compte.
DROP POLICY IF EXISTS "Active subcontractors read SST availability" ON public.sst_availability_calendar;
CREATE POLICY "Active subcontractors read SST availability"
  ON public.sst_availability_calendar
  FOR SELECT TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.subcontractors s
      WHERE s.user_id = auth.uid()
        AND s.active = true
    )
  );

-- 2) Un prestataire peut lire ses missions assignées, sans pouvoir les modifier.
DROP POLICY IF EXISTS "Assigned subcontractors read own missions" ON public.subcontractor_missions;
CREATE POLICY "Assigned subcontractors read own missions"
  ON public.subcontractor_missions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractors s
      WHERE s.id = subcontractor_missions.subcontractor_id
        AND s.user_id = auth.uid()
        AND s.active = true
    )
  );

-- 3) Les fiches de chantier SST ne sont visibles que si une mission les rattache
-- au prestataire connecté. Aucun accès général aux fiches des autres chantiers.
DROP POLICY IF EXISTS "Assigned subcontractors read linked worksite sheets" ON public.worksite_sheets;
CREATE POLICY "Assigned subcontractors read linked worksite sheets"
  ON public.worksite_sheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.worksite_sheet_id = worksite_sheets.id
        AND s.user_id = auth.uid()
        AND s.active = true
    )
  );

-- 4) Photos de mission en lecture uniquement pour le prestataire affecté.
DROP POLICY IF EXISTS "Assigned subcontractors read own mission photos" ON public.subcontractor_mission_photos;
CREATE POLICY "Assigned subcontractors read own mission photos"
  ON public.subcontractor_mission_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.id = subcontractor_mission_photos.mission_id
        AND s.user_id = auth.uid()
        AND s.active = true
    )
  );

-- 5) Les notifications du calendrier SST doivent aussi viser les prestataires actifs :
-- tous pour les disponibilités partagées, et uniquement ceux affectés à la fiche pour un chantier.
CREATE OR REPLACE FUNCTION public.sst_calendar_recipients(
  p_entity text,
  p_owner uuid,
  p_actor uuid,
  p_entity_id uuid DEFAULT NULL
)
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
    AND (
      p_entity = 'availability'
      OR (
        p_entity = 'worksite'
        AND EXISTS (
          SELECT 1
          FROM public.subcontractor_missions m
          WHERE m.subcontractor_id = s.id
            AND m.worksite_sheet_id = p_entity_id
        )
      )
    )

  UNION

  SELECT p_owner
  WHERE p_entity = 'worksite'
    AND p_owner IS NOT NULL
    AND p_owner IS DISTINCT FROM p_actor;
$$;

-- Le paramètre p_entity_id est nécessaire pour retrouver les prestataires affectés
-- à la fiche précise. Recrée la fonction d'enregistrement avec cet identifiant.
DROP FUNCTION IF EXISTS public.sst_calendar_record_change(text, uuid, text, date, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.sst_calendar_record_change(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_date date,
  p_summary text,
  p_details jsonb,
  p_owner uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_label text := public.sst_calendar_actor_label(auth.uid());
BEGIN
  INSERT INTO public.sst_calendar_changes
    (actor_id, actor_label, entity, entity_id, action, calendar_date, summary, details, owner_id)
  VALUES
    (v_actor, v_label, p_entity, p_entity_id, p_action, p_date, p_summary, COALESCE(p_details, '[]'::jsonb), p_owner);

  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT rc.user_id, 'sst_calendar', p_summary,
         NULLIF(
           (SELECT string_agg(
              CASE WHEN d->>'from' IS NULL AND d->>'to' IS NULL THEN d->>'label'
                   ELSE (d->>'label') || ' : ' || COALESCE(d->>'from', '—') || ' → ' || COALESCE(d->>'to', '—') END,
              ' · ')
            FROM jsonb_array_elements(COALESCE(p_details, '[]'::jsonb)) d),
           '')
  FROM public.sst_calendar_recipients(p_entity, p_owner, v_actor, p_entity_id) rc;
END;
$$;

-- Réinstalle les déclencheurs pour transmettre l'identifiant de fiche à la sélection des destinataires.
CREATE OR REPLACE FUNCTION public.sst_availability_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := public.sst_calendar_actor_label(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sst_calendar_record_change(
      'availability', NEW.id, 'created', NEW.date,
      v_label || ' s''est déclaré(e) disponible le ' || to_char(NEW.date, 'DD/MM/YYYY'),
      CASE WHEN NEW.comment IS NULL THEN '[]'::jsonb
           ELSE jsonb_build_array(jsonb_build_object('label', 'Commentaire', 'from', NULL, 'to', NEW.comment)) END,
      NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.date IS NOT DISTINCT FROM OLD.date AND NEW.comment IS NOT DISTINCT FROM OLD.comment THEN
      RETURN NEW;
    END IF;
    PERFORM public.sst_calendar_record_change(
      'availability', NEW.id, 'updated', NEW.date,
      v_label || ' a modifié une disponibilité du ' || to_char(NEW.date, 'DD/MM/YYYY'),
      jsonb_build_array(jsonb_build_object('label', 'Disponibilité', 'from', OLD.comment, 'to', NEW.comment)),
      NEW.user_id);
    RETURN NEW;
  ELSE
    PERFORM public.sst_calendar_record_change(
      'availability', OLD.id, 'deleted', OLD.date,
      v_label || ' a retiré une disponibilité du ' || to_char(OLD.date, 'DD/MM/YYYY'),
      CASE WHEN OLD.comment IS NULL THEN '[]'::jsonb
           ELSE jsonb_build_array(jsonb_build_object('label', 'Commentaire', 'from', OLD.comment, 'to', NULL)) END,
      OLD.user_id);
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.worksite_sheet_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := public.sst_calendar_actor_label(auth.uid());
  v_date date;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.intervention_date;
    IF v_date IS NOT NULL THEN
      PERFORM public.sst_calendar_record_change(
        'worksite', OLD.id, 'deleted', v_date,
        v_label || ' a retiré le chantier ' || COALESCE(NULLIF(OLD.client_name, ''), 'sans nom') ||
          ' du planning du ' || to_char(v_date, 'DD/MM/YYYY'),
        '[]'::jsonb, OLD.user_id);
    END IF;
    RETURN OLD;
  END IF;

  v_date := NEW.intervention_date;
  IF TG_OP = 'INSERT' THEN
    IF v_date IS NOT NULL THEN
      PERFORM public.sst_calendar_record_change(
        'worksite', NEW.id, 'created', v_date,
        v_label || ' a ajouté le chantier ' || COALESCE(NULLIF(NEW.client_name, ''), 'sans nom') ||
          ' au planning du ' || to_char(v_date, 'DD/MM/YYYY'),
        '[]'::jsonb, NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.intervention_date IS DISTINCT FROM OLD.intervention_date
     OR NEW.client_name IS DISTINCT FROM OLD.client_name
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.intervenant IS DISTINCT FROM OLD.intervenant
     OR NEW.tasks IS DISTINCT FROM OLD.tasks
     OR NEW.equipment IS DISTINCT FROM OLD.equipment
     OR NEW.epi IS DISTINCT FROM OLD.epi THEN
    v_name := COALESCE(NULLIF(NEW.client_name, ''), 'sans nom');
    PERFORM public.sst_calendar_record_change(
      'worksite', NEW.id, 'updated', COALESCE(NEW.intervention_date, OLD.intervention_date),
      v_label || ' a modifié le chantier ' || v_name || ' (' ||
        to_char(COALESCE(NEW.intervention_date, OLD.intervention_date), 'DD/MM/YYYY') || ')',
      '[]'::jsonb, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sst_availability_log_change ON public.sst_availability_calendar;
CREATE TRIGGER sst_availability_log_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sst_availability_calendar
  FOR EACH ROW EXECUTE FUNCTION public.sst_availability_log_change();

DROP TRIGGER IF EXISTS worksite_sheet_log_change ON public.worksite_sheets;
CREATE TRIGGER worksite_sheet_log_change
  AFTER INSERT OR UPDATE OR DELETE ON public.worksite_sheets
  FOR EACH ROW EXECUTE FUNCTION public.worksite_sheet_log_change();
