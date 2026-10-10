-- Backup PP CA : sauvegarde Excel hebdomadaire de la page Chiffre d'affaires.
-- Migration idempotente (peut être rejouée sans effet de bord).

-- 1) Journal des exécutions
CREATE TABLE IF NOT EXISTS public.pp_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL CHECK (trigger IN ('auto', 'manual')),
  status text NOT NULL CHECK (status IN ('success', 'error')),
  file_path text,
  size_bytes bigint,
  error_message text,
  triggered_by uuid
);

GRANT SELECT, INSERT ON public.pp_backup_runs TO authenticated;
GRANT ALL ON public.pp_backup_runs TO service_role;

ALTER TABLE public.pp_backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read backup runs" ON public.pp_backup_runs;
CREATE POLICY "Admins read backup runs"
ON public.pp_backup_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins create manual backup runs" ON public.pp_backup_runs;
CREATE POLICY "Admins create manual backup runs"
ON public.pp_backup_runs FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND trigger = 'manual' AND triggered_by = auth.uid()
);

CREATE INDEX IF NOT EXISTS pp_backup_runs_created_at_idx
  ON public.pp_backup_runs (created_at DESC);

-- 2) Bucket Storage privé + accès admin uniquement
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pp-backups', 'pp-backups', false, 20971520)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins manage PP backups" ON storage.objects;
CREATE POLICY "Admins manage PP backups"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'pp-backups' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'pp-backups' AND public.has_role(auth.uid(), 'admin'));

-- 3) Alerte aux admins en cas d'échec
CREATE OR REPLACE FUNCTION public.notify_admins_backup_failure(p_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT DISTINCT ur.user_id, 'system_alert', 'Échec du backup PP CA', left(p_message, 1000)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
$$;
REVOKE ALL ON FUNCTION public.notify_admins_backup_failure(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins_backup_failure(text) TO service_role;

-- 4) Planification hebdomadaire (pg_cron + pg_net)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Clé partagée générée dans la base (Vault) : jamais écrite en clair dans le dépôt.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pp_ca_backup_key') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'pp_ca_backup_key',
      'Clé d''appel du backup PP CA hebdomadaire'
    );
  END IF;
END
$$;

-- Vérification de la clé côté base (service_role uniquement, comparaison exacte).
CREATE OR REPLACE FUNCTION public.pp_ca_backup_key_ok(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT COALESCE(
    (SELECT ds.decrypted_secret = p_key
       FROM vault.decrypted_secrets ds
      WHERE ds.name = 'pp_ca_backup_key'
      LIMIT 1),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.pp_ca_backup_key_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_ca_backup_key_ok(text) TO service_role;

-- Appel de la route : dimanche 01:00 et 02:00 UTC. La route n'exécute que si
-- l'heure Europe/Paris est 03h (gestion heure d'été/hiver) et une seule fois par semaine.
CREATE OR REPLACE FUNCTION public.pp_ca_backup_trigger()
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
    url := 'https://crjardin.lovable.app/api/public/pp-ca-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pp-backup-key', v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END
$$;
REVOKE ALL ON FUNCTION public.pp_ca_backup_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_ca_backup_trigger() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('pp-ca-backup-01utc', 'pp-ca-backup-02utc');
SELECT cron.schedule('pp-ca-backup-01utc', '0 1 * * 0', $$SELECT public.pp_ca_backup_trigger()$$);
SELECT cron.schedule('pp-ca-backup-02utc', '0 2 * * 0', $$SELECT public.pp_ca_backup_trigger()$$);
