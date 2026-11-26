-- Notifie l'administrateur (in-app + e-mail) à la première ouverture d'un
-- e-mail de compte-rendu par le client. Se déclenche uniquement sur le
-- premier INSERT dans email_opens (une ouverture par message_id), jamais
-- sur les incréments de open_count qui passent par UPDATE.
CREATE OR REPLACE FUNCTION public.handle_email_opened()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log record;
  v_admin record;
  v_html text;
BEGIN
  SELECT recipient_email, template_name
  INTO v_log
  FROM public.email_send_log
  WHERE message_id = NEW.message_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_log IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      v_admin.user_id,
      'email_ouvert',
      'E-mail ouvert par le client',
      'Le compte-rendu envoyé à ' || v_log.recipient_email || ' a été ouvert.'
    );
  END LOOP;

  -- Envoi de l'e-mail : best-effort, ne doit jamais faire échouer le pixel
  -- ni annuler les notifications déjà insérées ci-dessus.
  BEGIN
    v_html :=
      '<div style="font-family:Garamond,Georgia,serif;background:#ffffff;padding:24px;max-width:600px;margin:0 auto;color:#2f3a26">'
      || '<p style="font-size:22px;font-weight:700;color:#4F8E33;margin:0;text-align:center">De la graine au jardin</p>'
      || '<p style="font-size:14px;color:#EE8627;margin:2px 0 16px;font-style:italic;text-align:center">au rythme de la nature</p>'
      || '<hr style="border:none;border-top:1px solid #e6e6e6;margin:0 0 20px"/>'
      || '<p style="font-size:16px;line-height:1.6">Le compte-rendu envoyé à <strong>'
      || replace(replace(v_log.recipient_email,'<','&lt;'),'>','&gt;')
      || '</strong> vient d''être ouvert.</p>'
      || '<p style="font-size:16px;line-height:1.6"><a href="https://crjardin.lovable.app/emails" style="color:#4F8E33;font-weight:700">Voir le suivi des e-mails</a></p>'
      || '</div>';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', gen_random_uuid()::text,
      'to', 'fournier.anthony2009@gmail.com',
      'from', 'crjardin <noreply@delagraineaujardin.com>',
      'sender_domain', 'notify.delagraineaujardin.com',
      'subject', 'E-mail ouvert par ' || v_log.recipient_email,
      'html', v_html,
      'text', 'Le compte-rendu envoyé à ' || v_log.recipient_email || ' a été ouvert. Suivi : https://crjardin.lovable.app/emails',
      'purpose', 'transactional',
      'label', 'email-ouvert',
      'idempotency_key', 'email-open-' || NEW.message_id,
      'queued_at', now()
    ));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- ne jamais bloquer le tracking pixel si la notif échoue
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_email_opened ON public.email_opens;

CREATE TRIGGER trg_email_opened
AFTER INSERT ON public.email_opens
FOR EACH ROW
EXECUTE FUNCTION public.handle_email_opened();
