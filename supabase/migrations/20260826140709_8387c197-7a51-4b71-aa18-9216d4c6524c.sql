-- 1. Fixed search_path on email queue helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- 2. Migration log readable by admins only
DROP POLICY IF EXISTS "migration_log_read_authenticated" ON public.pilot_migration_log;
CREATE POLICY "migration_log_read_admin" ON public.pilot_migration_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Audit log entries must belong to their author
ALTER TABLE public.referential_audit_log ALTER COLUMN user_id SET DEFAULT auth.uid();
DROP POLICY IF EXISTS "Authenticated can append referential audit log" ON public.referential_audit_log;
CREATE POLICY "Authenticated can append own referential audit log" ON public.referential_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Storage: owner-scoped update/delete, upload ownership on chantier-photos
DROP POLICY IF EXISTS "Authenticated upload chantier photos" ON storage.objects;
CREATE POLICY "Authenticated upload chantier photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chantier-photos' AND owner = auth.uid());

CREATE POLICY "Owners update own chantier photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chantier-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'chantier-photos' AND owner = auth.uid());

CREATE POLICY "Owners delete own chantier photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chantier-photos' AND owner = auth.uid());

CREATE POLICY "Owners update own intervention reports" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'intervention-reports' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'intervention-reports' AND owner = auth.uid());

CREATE POLICY "Owners delete own intervention reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'intervention-reports' AND owner = auth.uid());