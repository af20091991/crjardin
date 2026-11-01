-- Protection des données PP (incident du 31/10/2026 : suppression d'un compte => fiches, interventions
-- et liens du chiffre d'affaires perdus).
-- 1) Suppression massive refusée sur les tables métier, sauf opération explicite.
-- 2) Une fiche client liée à des données ne peut plus être supprimée (RESTRICT, plus de SET NULL/CASCADE).
-- 3) Un compte qui possède des fiches, interventions ou lignes de CA ne peut pas être supprimé.
-- 4) Réimport d'une année de CA passé par une fonction contrôlée (journalisée).

-- 1) Garde-fou des suppressions massives + archivage de toute ligne supprimée (corbeille)
CREATE TABLE IF NOT EXISTS public.pp_deleted_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid DEFAULT auth.uid(),
  table_name text NOT NULL,
  row_data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS pp_deleted_rows_table_idx ON public.pp_deleted_rows (table_name, deleted_at DESC);
ALTER TABLE public.pp_deleted_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins lisent la corbeille" ON public.pp_deleted_rows;
CREATE POLICY "Admins lisent la corbeille" ON public.pp_deleted_rows
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.pp_deleted_rows FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_guard_bulk_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM old_rows;
  IF n > 25 AND coalesce(current_setting('pp.bulk_delete_ok', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Suppression de % lignes dans % refusée : protection des données PP', n, TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_TABLE_NAME <> 'pp_deleted_rows' THEN
    INSERT INTO public.pp_deleted_rows (table_name, row_data)
    SELECT TG_TABLE_NAME, to_jsonb(o) FROM old_rows o;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'interventions', 'intervention_photos', 'intervention_report_history',
    'pilot_ca_entries', 'pilot_ca_match_log', 'subcontractors', 'subcontractor_missions',
    'subcontractor_mission_photos', 'worksite_sheets', 'admin_audit_log', 'client_merge_log'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS pp_guard_bulk_delete_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER pp_guard_bulk_delete_%1$s AFTER DELETE ON public.%1$I '
        'REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT '
        'EXECUTE FUNCTION public.pp_guard_bulk_delete()', t);
    END IF;
  END LOOP;
END
$$;

-- 2) Fiches clients : aucune suppression silencieuse des liens
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.clients'::regclass
      AND c.confdeltype IN ('c', 'n', 'd')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE RESTRICT',
      r.tbl, r.conname,
      regexp_replace(r.def, '\s+ON DELETE (CASCADE|SET NULL|SET DEFAULT|NO ACTION|RESTRICT)', '', 'g')
    );
  END LOOP;
END
$$;

-- 3) Suppression de compte : refusée tant que le compte possède des données métier
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_clients integer;
  v_interventions integer;
  v_ca integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  SELECT count(*) INTO v_clients FROM public.clients WHERE user_id = p_user_id;
  SELECT count(*) INTO v_interventions FROM public.interventions WHERE user_id = p_user_id;
  SELECT count(*) INTO v_ca FROM public.pilot_ca_entries WHERE user_id = p_user_id;
  IF v_clients + v_interventions + v_ca > 0 THEN
    RAISE EXCEPTION 'Suppression refusée : ce compte possède % fiche(s) client, % intervention(s) et % ligne(s) de chiffre d''affaires. Transférez-les vers un autre compte avant de supprimer.',
      v_clients, v_interventions, v_ca
      USING ERRCODE = 'P0001';
  END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = p_user_id;
  PERFORM public.log_admin_action('user_deleted', p_user_id, jsonb_build_object('name', v_name));

  DELETE FROM public.intervention_photos WHERE user_id = p_user_id;
  DELETE FROM public.intervention_tasks WHERE user_id = p_user_id;
  DELETE FROM public.garden_health WHERE user_id = p_user_id;
  DELETE FROM public.recommendations WHERE user_id = p_user_id;
  DELETE FROM public.reminders WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.favorite_tasks WHERE user_id = p_user_id;
  DELETE FROM public.report_templates WHERE user_id = p_user_id;
  DELETE FROM public.intervention_counters WHERE user_id = p_user_id;
  DELETE FROM public.login_events WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;

-- 4) Réimport d'une année de CA : seule voie autorisée pour supprimer en masse des lignes de CA
CREATE OR REPLACE FUNCTION public.pp_replace_ca_year(p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  PERFORM set_config('pp.bulk_delete_ok', 'on', true);
  DELETE FROM public.pilot_ca_entries WHERE year = p_year;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_admin_action('ca_year_replaced', NULL, jsonb_build_object('year', p_year, 'lignes_supprimees', n));
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.pp_replace_ca_year(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pp_replace_ca_year(integer) TO authenticated;
