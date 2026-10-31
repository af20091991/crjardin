-- Notifier le prestataire dès qu'une mission lui est attribuée (création)
-- ou modifiée (date, statut, prestation, instructions).
-- Cible uniquement le compte Auth explicitement lié (subcontractors.auth_user_id).
-- Ne modifie aucune politique d'écriture ni de lecture.

CREATE OR REPLACE FUNCTION public.pp_notify_sst_mission_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_title text;
  v_body text;
BEGIN
  SELECT s.auth_user_id INTO v_target
  FROM public.subcontractors s
  WHERE s.id = NEW.subcontractor_id
    AND s.active = true
    AND s.auth_user_id IS NOT NULL;

  IF v_target IS NULL
     OR v_target IS NOT DISTINCT FROM auth.uid()
     OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_target AND r.role = 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_title := 'Nouvelle mission attribuée';
    v_body := NEW.service_requested || ' · ' || to_char(NEW.mission_date, 'DD/MM/YYYY');
  ELSE
    IF NEW.mission_date IS NOT DISTINCT FROM OLD.mission_date
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.service_requested IS NOT DISTINCT FROM OLD.service_requested
       AND NEW.instructions IS NOT DISTINCT FROM OLD.instructions THEN
      RETURN NEW;
    END IF;
    v_title := 'Mission modifiée';
    v_body := NEW.service_requested || ' · ' || to_char(NEW.mission_date, 'DD/MM/YYYY');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_target, 'sst_mission', v_title, v_body);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Une notification ne doit jamais bloquer l'enregistrement d'une mission.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sst_mission_assignment_notify ON public.subcontractor_missions;
CREATE TRIGGER trg_sst_mission_assignment_notify
  AFTER INSERT OR UPDATE OF mission_date, status, service_requested, instructions, subcontractor_id
  ON public.subcontractor_missions
  FOR EACH ROW EXECUTE FUNCTION public.pp_notify_sst_mission_assignment();
