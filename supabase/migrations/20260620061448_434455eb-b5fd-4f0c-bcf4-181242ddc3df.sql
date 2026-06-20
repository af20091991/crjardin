-- 1) Storage: authenticated only (remove anon)
DROP POLICY IF EXISTS "Anyone can upload chantier photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read chantier photos" ON storage.objects;

CREATE POLICY "Authenticated upload chantier photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chantier-photos');

CREATE POLICY "Authenticated read chantier photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chantier-photos');

-- 2) Profiles: own profile only, admins see all
DROP POLICY IF EXISTS "Authenticated read all profiles" ON public.profiles;
CREATE POLICY "Read own or admin profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 3) Client messages: only the owning client's owner or admin
DROP POLICY IF EXISTS "Authenticated read client messages" ON public.client_messages;
DROP POLICY IF EXISTS "Authenticated update client messages" ON public.client_messages;

CREATE POLICY "Owner or admin read client messages" ON public.client_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_messages.client_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Owner or admin update client messages" ON public.client_messages
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_messages.client_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_messages.client_id AND c.user_id = auth.uid())
  );

-- 4) Share access log: only the owning client's owner or admin
DROP POLICY IF EXISTS "Authenticated read access log" ON public.share_access_log;
CREATE POLICY "Owner or admin read access log" ON public.share_access_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = share_access_log.client_id AND c.user_id = auth.uid())
  );