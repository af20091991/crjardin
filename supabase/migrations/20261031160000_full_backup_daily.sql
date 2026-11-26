-- Sauvegarde quotidienne complète (JSON) de toutes les tables publiques et de l'index du stockage,
-- dans le bucket privé pp-backups. Conservation : 60 jours. Réutilise la clé Vault pp_ca_backup_key.

-- Bucket : fichiers de sauvegarde plus volumineux
UPDATE storage.buckets SET file_size_limit = 209715200 WHERE id = 'pp-backups';

-- Journal des sauvegardes complètes (séparé de pp_backup_runs, réservé au backup CA hebdomadaire)
CREATE TABLE IF NOT EXISTS public.pp_full_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'error')),
  folder text,
  tables_count integer,
  rows_count integer,
  size_bytes bigint,
  error_message text
);
ALTER TABLE public.pp_full_backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins lisent les sauvegardes" ON public.pp_full_backup_runs;
CREATE POLICY "Admins lisent les sauvegardes" ON public.pp_full_backup_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Liste des tables publiques à sauvegarder
CREATE OR REPLACE FUNCTION public.pp_backup_table_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(table_name::text ORDER BY table_name), '{}')
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
$$;

-- Contenu complet d'une table, en JSON
CREATE OR REPLACE FUNCTION public.pp_backup_table_json(p_table text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_table NOT IN (SELECT table_name::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') THEN
    RAISE EXCEPTION 'Table inconnue : %', p_table;
  END IF;
  EXECUTE format('SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM public.%I t', p_table) INTO result;
  RETURN result;
END;
$$;

-- Index des fichiers du stockage (chemins, dates, tailles) : permet de retrouver les photos orphelines
CREATE OR REPLACE FUNCTION public.pp_backup_storage_index()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'bucket', bucket_id, 'name', name, 'created_at', created_at,
    'size', (metadata->>'size')::bigint, 'mimetype', metadata->>'mimetype'
  ) ORDER BY bucket_id, name), '[]'::jsonb)
  FROM storage.objects;
$$;

REVOKE ALL ON FUNCTION public.pp_backup_table_names() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_backup_table_json(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_backup_storage_index() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_backup_table_names() TO service_role;
GRANT EXECUTE ON FUNCTION public.pp_backup_table_json(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pp_backup_storage_index() TO service_role;

-- Déclenchement quotidien (01:30 UTC = 02:30 ou 03:30 Paris selon la saison)
CREATE OR REPLACE FUNCTION public.pp_full_backup_trigger()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'pp_ca_backup_key' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Clé pp_ca_backup_key absente du Vault';
  END IF;
  PERFORM net.http_post(
    url := 'https://crjardin.lovable.app/api/public/pp-full-backup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pp-backup-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
END
$$;
REVOKE ALL ON FUNCTION public.pp_full_backup_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_full_backup_trigger() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pp-full-backup-daily';
SELECT cron.schedule('pp-full-backup-daily', '30 1 * * *', $$SELECT public.pp_full_backup_trigger()$$);
