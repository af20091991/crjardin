CREATE OR REPLACE FUNCTION public.add_client_message(
  p_token text, p_intervention_id uuid, p_kind text, p_content text, p_author_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client public.clients;
  v_owner uuid;
  v_msg_id uuid;
  v_kind text;
  v_owner_email text;
  v_content_clean text;
  v_html text;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE share_token = p_token;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Lien invalide'; END IF;
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN RAISE EXCEPTION 'Message vide'; END IF;

  v_kind := CASE WHEN p_kind = 'question' THEN 'question' ELSE 'annotation' END;
  v_content_clean := left(trim(p_content), 2000);

  -- determine recipient: intervention owner if provided, else client owner
  IF p_intervention_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.interventions WHERE id = p_intervention_id AND client_id = v_client.id;
  END IF;
  v_owner := COALESCE(v_owner, v_client.user_id);

  INSERT INTO public.client_messages (client_id, intervention_id, kind, content, author_name)
  VALUES (v_client.id, p_intervention_id, v_kind, v_content_clean, p_author_name)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications (user_id, type, title, body, client_id, intervention_id)
  VALUES (v_owner, v_kind,
    v_client.name || (CASE WHEN v_kind = 'question' THEN ' a posé une question' ELSE ' a ajouté une annotation' END),
    left(trim(p_content), 300), v_client.id, p_intervention_id);

  -- Email notification to the owner (best-effort, never blocks the client message)
  BEGIN
    SELECT email INTO v_owner_email FROM auth.users WHERE id = v_owner;
    IF v_owner_email IS NOT NULL THEN
      v_html :=
        '<div style="font-family:Garamond,Georgia,serif;background:#ffffff;padding:24px;max-width:600px;margin:0 auto;color:#2f3a26">'
        || '<p style="font-size:22px;font-weight:700;color:#4F8E33;margin:0;text-align:center">De la graine au jardin</p>'
        || '<p style="font-size:14px;color:#EE8627;margin:2px 0 16px;font-style:italic;text-align:center">au rythme de la nature</p>'
        || '<hr style="border:none;border-top:1px solid #e6e6e6;margin:0 0 20px"/>'
        || '<p style="font-size:16px;line-height:1.6"><strong>' || replace(replace(v_client.name,'<','&lt;'),'>','&gt;') || '</strong> '
        || (CASE WHEN v_kind = 'question' THEN 'a posé une question' ELSE 'a ajouté une annotation' END)
        || ' sur sa fiche.</p>'
        || '<blockquote style="border-left:3px solid #4F8E33;margin:16px 0;padding:8px 16px;background:#f6f8f3;font-size:15px;line-height:1.6">'
        || replace(replace(v_content_clean,'<','&lt;'),'>','&gt;') || '</blockquote>'
        || '<p style="font-size:16px;line-height:1.6"><a href="https://crjardin.lovable.app/clients/' || v_client.id::text || '" style="color:#4F8E33;font-weight:700">Ouvrir la fiche client</a></p>'
        || '</div>';

      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'message_id', gen_random_uuid()::text,
        'to', v_owner_email,
        'from', 'crjardin <noreply@delagraineaujardin.com>',
        'sender_domain', 'notify.delagraineaujardin.com',
        'subject', (CASE WHEN v_kind = 'question' THEN 'Nouvelle question de ' ELSE 'Nouvelle annotation de ' END) || v_client.name,
        'html', v_html,
        'text', v_client.name || (CASE WHEN v_kind = 'question' THEN ' a posé une question : ' ELSE ' a ajouté une annotation : ' END) || v_content_clean || ' — https://crjardin.lovable.app/clients/' || v_client.id::text,
        'purpose', 'transactional',
        'label', 'client-message',
        'idempotency_key', 'client-message-' || v_msg_id::text,
        'queued_at', now()
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the client message if email enqueue fails
  END;

  RETURN v_msg_id;
END;
$function$;