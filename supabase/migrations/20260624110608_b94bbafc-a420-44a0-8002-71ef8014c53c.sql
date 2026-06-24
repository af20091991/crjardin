-- 1. Email open tracking table
CREATE TABLE public.email_opens (
  message_id text PRIMARY KEY,
  opened_at timestamptz NOT NULL DEFAULT now(),
  open_count integer NOT NULL DEFAULT 1,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_opens TO service_role;
GRANT SELECT ON public.email_opens TO authenticated;

ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email opens"
ON public.email_opens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Notify admin by email on a new pending signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := NEW.email = 'fournier.anthony2009@gmail.com';
  v_admin record;
  v_name text := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);
  v_html text;
BEGIN
  INSERT INTO public.profiles (id, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    v_name,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_admin THEN now() ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::app_role ELSE 'observateur'::app_role END)
  ON CONFLICT DO NOTHING;

  IF NOT v_is_admin THEN
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (v_admin.user_id, 'question', 'Nouvelle inscription à valider',
        v_name || ' demande l''accès à l''application.');
    END LOOP;

    -- Send an email notification to the administrator (best-effort, never blocks signup)
    BEGIN
      v_html :=
        '<div style="font-family:Garamond,Georgia,serif;background:#ffffff;padding:24px;max-width:600px;margin:0 auto;color:#2f3a26">'
        || '<p style="font-size:22px;font-weight:700;color:#4F8E33;margin:0;text-align:center">De la graine au jardin</p>'
        || '<p style="font-size:14px;color:#EE8627;margin:2px 0 16px;font-style:italic;text-align:center">au rythme de la nature</p>'
        || '<hr style="border:none;border-top:1px solid #e6e6e6;margin:0 0 20px"/>'
        || '<p style="font-size:16px;line-height:1.6">Une nouvelle inscription est <strong>en attente de validation</strong>.</p>'
        || '<p style="font-size:16px;line-height:1.6">Nom / Entreprise : <strong>' || replace(replace(v_name,'<','&lt;'),'>','&gt;') || '</strong><br/>'
        || 'E-mail : <strong>' || replace(replace(NEW.email,'<','&lt;'),'>','&gt;') || '</strong></p>'
        || '<p style="font-size:16px;line-height:1.6">Connectez-vous à l''espace d''administration pour approuver ou refuser ce compte :</p>'
        || '<p style="font-size:16px;line-height:1.6"><a href="https://crjardin.lovable.app/admin" style="color:#4F8E33;font-weight:700">Ouvrir l''administration</a></p>'
        || '</div>';

      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'message_id', gen_random_uuid()::text,
        'to', 'fournier.anthony2009@gmail.com',
        'from', 'crjardin <noreply@delagraineaujardin.com>',
        'sender_domain', 'notify.delagraineaujardin.com',
        'subject', 'Nouvelle inscription à valider — ' || v_name,
        'html', v_html,
        'text', 'Nouvelle inscription en attente : ' || v_name || ' (' || NEW.email || '). Validez le compte dans l''administration : https://crjardin.lovable.app/admin',
        'purpose', 'transactional',
        'label', 'admin-nouvelle-inscription',
        'idempotency_key', 'signup-' || NEW.id::text,
        'queued_at', now()
      ));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never block signup if email enqueue fails
    END;
  END IF;

  RETURN NEW;
END;
$function$;