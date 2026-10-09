CREATE TABLE public.pp_backup_runs (
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

CREATE POLICY "Admins read backup runs"
ON public.pp_backup_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create manual backup runs"
ON public.pp_backup_runs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND trigger = 'manual' AND triggered_by = auth.uid());

CREATE INDEX pp_backup_runs_created_at_idx ON public.pp_backup_runs (created_at DESC);
CREATE UNIQUE INDEX pp_backup_runs_auto_week_idx
ON public.pp_backup_runs ((date_trunc('week', created_at AT TIME ZONE 'Europe/Paris')))
WHERE trigger = 'auto' AND status = 'success';

CREATE POLICY "Admins manage PP backups"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'pp-backups' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'pp-backups' AND public.has_role(auth.uid(), 'admin'));

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