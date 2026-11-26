-- Actualisation quotidienne du Radar Visibilité locale (06h Europe/Paris).
-- Réutilise la clé du Vault et la fonction de vérification du backup PP CA.
CREATE OR REPLACE FUNCTION public.radar_quotidien_trigger()
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
    url := 'https://crjardin.lovable.app/api/public/radar-quotidien',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pp-backup-key', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END
$$;
REVOKE ALL ON FUNCTION public.radar_quotidien_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_quotidien_trigger() TO service_role;

-- 04h et 05h UTC : la route ne s'exécute que si l'heure de Paris est 06h (été/hiver), une fois par jour.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('radar-quotidien-04utc', 'radar-quotidien-05utc');
SELECT cron.schedule('radar-quotidien-04utc', '0 4 * * *', $$SELECT public.radar_quotidien_trigger()$$);
SELECT cron.schedule('radar-quotidien-05utc', '0 5 * * *', $$SELECT public.radar_quotidien_trigger()$$);
