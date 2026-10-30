-- Liaison explicite entre une fiche sous-traitant et son compte Auth.
-- Ne détourne pas subcontractors.user_id, qui reste le propriétaire interne de la fiche.
ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subcontractors_auth_user_id_uidx
  ON public.subcontractors(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Association automatique uniquement sur e-mail exact et correspondance 1:1.
-- Aucun rapprochement par prénom/nom n'est autorisé.
CREATE OR REPLACE FUNCTION public.pp_link_subcontractor_auth_user(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_subcontractor_id uuid;
  v_ids uuid[];
  v_count integer;
BEGIN
  SELECT lower(btrim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  SELECT count(*), array_agg(s.id) INTO v_count, v_ids
  FROM public.subcontractors s
  WHERE lower(btrim(s.email)) = v_email
    AND s.auth_user_id IS NULL;

  IF v_count <> 1 THEN
    RETURN 0;
  END IF;
  v_subcontractor_id := v_ids[1];

  -- Une adresse d'authentification ne doit correspondre qu'à un seul compte.
  IF (SELECT count(*) FROM auth.users u WHERE lower(btrim(u.email)) = v_email) <> 1 THEN
    RETURN 0;
  END IF;

  UPDATE public.subcontractors
  SET auth_user_id = _user_id, updated_at = now()
  WHERE id = v_subcontractor_id
    AND auth_user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_link_subcontractor_auth_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_link_subcontractor_auth_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pp_profiles_link_subcontractor_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pp_link_subcontractor_auth_user(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Une association SST ne doit jamais bloquer la création d'un profil.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_link_subcontractor_auth ON public.profiles;
CREATE TRIGGER trg_profiles_link_subcontractor_auth
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.pp_profiles_link_subcontractor_auth();

CREATE OR REPLACE FUNCTION public.pp_subcontractor_email_link_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_user_ids uuid[];
  v_count integer;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' OR NEW.auth_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*), array_agg(u.id) INTO v_count, v_user_ids
  FROM auth.users u
  WHERE lower(btrim(u.email)) = lower(btrim(NEW.email));

  IF v_count = 1 THEN
    v_user_id := v_user_ids[1];
    PERFORM public.pp_link_subcontractor_auth_user(v_user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subcontractor_email_link_auth ON public.subcontractors;
CREATE TRIGGER trg_subcontractor_email_link_auth
AFTER INSERT OR UPDATE OF email ON public.subcontractors
FOR EACH ROW EXECUTE FUNCTION public.pp_subcontractor_email_link_auth();

-- Rattrapage des comptes déjà créés : seulement les e-mails exacts et uniques.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.subcontractors s
        WHERE lower(btrim(s.email)) = lower(btrim(u.email))
          AND s.auth_user_id IS NULL
      )
  LOOP
    PERFORM public.pp_link_subcontractor_auth_user(r.id);
  END LOOP;
END;
$$;

-- Rendre visible la fiche du prestataire lui-même sans exposer les autres fiches.
DROP POLICY IF EXISTS "Assigned subcontractors read own profile" ON public.subcontractors;
CREATE POLICY "Assigned subcontractors read own profile"
  ON public.subcontractors FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() AND active = true);

-- Calendrier : les prestataires reliés à leur compte peuvent consulter le calendrier partagé.
DROP POLICY IF EXISTS "Active subcontractors read SST availability" ON public.sst_availability_calendar;
CREATE POLICY "Active subcontractors read SST availability"
  ON public.sst_availability_calendar FOR SELECT TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.auth_user_id = auth.uid() AND s.active = true
    )
  );

-- Missions attribuées : lecture seule pour le compte Auth explicitement lié.
DROP POLICY IF EXISTS "Assigned subcontractors read own missions" ON public.subcontractor_missions;
CREATE POLICY "Assigned subcontractors read own missions"
  ON public.subcontractor_missions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id = subcontractor_missions.subcontractor_id
        AND s.auth_user_id = auth.uid() AND s.active = true
    )
  );

-- Fiches de chantier liées aux missions attribuées.
DROP POLICY IF EXISTS "Assigned subcontractors read linked worksite sheets" ON public.worksite_sheets;
CREATE POLICY "Assigned subcontractors read linked worksite sheets"
  ON public.worksite_sheets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.worksite_sheet_id = worksite_sheets.id
        AND s.auth_user_id = auth.uid() AND s.active = true
    )
  );

-- Métadonnées des photos des missions attribuées.
DROP POLICY IF EXISTS "Assigned subcontractors read own mission photos" ON public.subcontractor_mission_photos;
CREATE POLICY "Assigned subcontractors read own mission photos"
  ON public.subcontractor_mission_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_missions m
      JOIN public.subcontractors s ON s.id = m.subcontractor_id
      WHERE m.id = subcontractor_mission_photos.mission_id
        AND s.auth_user_id = auth.uid() AND s.active = true
    )
  );

-- Notifications calendrier : cibler le compte Auth du prestataire, pas le propriétaire interne de sa fiche.
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
  SELECT s.auth_user_id
  FROM public.subcontractors s
  WHERE s.active = true
    AND s.auth_user_id IS NOT NULL
    AND s.auth_user_id IS DISTINCT FROM p_actor
    AND p_entity = 'availability'
  UNION
  SELECT p_owner
  WHERE p_entity = 'worksite'
    AND p_owner IS NOT NULL
    AND p_owner IS DISTINCT FROM p_actor;
$$;

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
  SELECT DISTINCT s.auth_user_id, 'sst_calendar', NEW.summary,
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
    AND s.auth_user_id IS NOT NULL
    AND s.auth_user_id IS DISTINCT FROM NEW.actor_id
    AND s.auth_user_id IS DISTINCT FROM NEW.owner_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = s.auth_user_id AND r.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = s.auth_user_id
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

-- Photos des fiches et des missions : autoriser la lecture des seuls objets liés
-- à une fiche/mission attribuée au compte SST. Ne donne aucun droit d'écriture.
DROP POLICY IF EXISTS "Assigned subcontractors read linked SST photos" ON storage.objects;
CREATE POLICY "Assigned subcontractors read linked SST photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chantier-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM public.subcontractor_mission_photos p
        JOIN public.subcontractor_missions m ON m.id = p.mission_id
        JOIN public.subcontractors s ON s.id = m.subcontractor_id
        WHERE p.storage_path = storage.objects.name
          AND s.auth_user_id = auth.uid()
          AND s.active = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.worksite_sheets ws
        JOIN public.subcontractor_missions m ON m.worksite_sheet_id = ws.id
        JOIN public.subcontractors s ON s.id = m.subcontractor_id
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(ws.photos) = 'array' THEN ws.photos ELSE '[]'::jsonb END
          ) AS photo(storage_path)
          WHERE photo.storage_path = storage.objects.name
        )
          AND s.auth_user_id = auth.uid()
          AND s.active = true
      )
    )
  );
