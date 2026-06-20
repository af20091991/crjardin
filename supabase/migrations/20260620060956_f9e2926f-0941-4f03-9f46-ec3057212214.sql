-- 1) Approval status on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Existing users keep access
UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE approval_status = 'pending';

-- 2) Login tracking
CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own login event" ON public.login_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads login events" ON public.login_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) Approval check helper
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND approval_status = 'approved'
  ) OR public.has_role(_user_id, 'admin')
$$;

-- 4) Admin sets approval status
CREATE OR REPLACE FUNCTION public.set_user_approval(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;
  UPDATE public.profiles
  SET approval_status = p_status,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE NULL END
  WHERE id = p_user_id;

  IF p_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (p_user_id, 'read', 'Compte validé',
      'Votre accès à l''application a été validé. Bienvenue !');
  END IF;
END;
$$;

-- 5) Record a login (called from client after sign-in)
CREATE OR REPLACE FUNCTION public.record_login(p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.login_events (user_id, user_agent) VALUES (auth.uid(), p_user_agent);
END;
$$;

-- 6) Notify admins on new signup + set status in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := NEW.email = 'fournier.anthony2009@gmail.com';
  v_admin record;
BEGIN
  INSERT INTO public.profiles (id, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_admin THEN now() ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    -- notify every admin of the pending signup
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (v_admin.user_id, 'question', 'Nouvelle inscription à valider',
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email) || ' demande l''accès à l''application.');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;