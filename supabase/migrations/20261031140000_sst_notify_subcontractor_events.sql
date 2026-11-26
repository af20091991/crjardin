-- Notifications in-app au prestataire concerné pour tout élément le concernant :
-- fiche de chantier (création, changement de date/intervenants/statut/tâches…),
-- photo ajoutée à une mission, mission supprimée.
-- Cible uniquement le compte Auth lié à la fiche sous-traitant, jamais l'auteur de l'action.

CREATE OR REPLACE FUNCTION public.pp_notify_sst_worksite_assignees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF NEW.intervenant IS NULL OR btrim(NEW.intervenant) = '' THEN
    RETURN NEW;
  END IF;

  v_title := CASE WHEN TG_OP = 'INSERT' THEN 'Nouvelle fiche SST' ELSE 'Fiche SST mise à jour' END;
  v_body := COALESCE(NEW.client_name, NEW.address, 'Chantier')
    || CASE WHEN NEW.intervention_date IS NOT NULL
         THEN ' · ' || to_char(NEW.intervention_date, 'DD/MM/YYYY') ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT DISTINCT s.auth_user_id, 'sst_worksite', v_title, v_body
  FROM public.subcontractors s
  WHERE s.active = true
    AND s.auth_user_id IS NOT NULL
    AND s.auth_user_id IS DISTINCT FROM auth.uid()
    AND (NEW.intervenant = s.name OR NEW.intervenant LIKE '%"' || s.name || '"%');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sst_worksite_assignee_notify ON public.worksite_sheets;
CREATE TRIGGER trg_sst_worksite_assignee_notify
  AFTER INSERT OR UPDATE OF intervention_date, intervenant, planning_status, address, notes, tasks, equipment, epi, checklist
  ON public.worksite_sheets
  FOR EACH ROW EXECUTE FUNCTION public.pp_notify_sst_worksite_assignees();

CREATE OR REPLACE FUNCTION public.pp_notify_sst_mission_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  SELECT s.auth_user_id INTO v_target
  FROM public.subcontractor_missions m
  JOIN public.subcontractors s ON s.id = m.subcontractor_id
  WHERE m.id = NEW.mission_id AND s.active = true AND s.auth_user_id IS NOT NULL;

  IF v_target IS NOT NULL AND v_target IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_target, 'sst_mission', 'Nouvelle photo de mission', COALESCE(NEW.caption, 'Photo ajoutée'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sst_mission_photo_notify ON public.subcontractor_mission_photos;
CREATE TRIGGER trg_sst_mission_photo_notify
  AFTER INSERT ON public.subcontractor_mission_photos
  FOR EACH ROW EXECUTE FUNCTION public.pp_notify_sst_mission_photo();

CREATE OR REPLACE FUNCTION public.pp_notify_sst_mission_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  SELECT s.auth_user_id INTO v_target
  FROM public.subcontractors s
  WHERE s.id = OLD.subcontractor_id AND s.active = true AND s.auth_user_id IS NOT NULL;

  IF v_target IS NOT NULL AND v_target IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_target, 'sst_mission', 'Mission annulée',
      OLD.service_requested || ' · ' || to_char(OLD.mission_date, 'DD/MM/YYYY'));
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sst_mission_deleted_notify ON public.subcontractor_missions;
CREATE TRIGGER trg_sst_mission_deleted_notify
  AFTER DELETE ON public.subcontractor_missions
  FOR EACH ROW EXECUTE FUNCTION public.pp_notify_sst_mission_deleted();
