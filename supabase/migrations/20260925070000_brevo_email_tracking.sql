-- Suivi des emails envoyés via Brevo depuis contact@delagraineaujardin.com
-- (distinct du suivi des CR chantiers, qui passe par le service email natif Lovable
-- et alimente déjà public.email_send_log / public.email_opens).

CREATE TABLE public.brevo_email_log (
  message_id text PRIMARY KEY,
  sender_email text,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  error_message text,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brevo_email_log IS
  'Historique des emails envoyés via Brevo, alimenté par le webhook /api/public/brevo-webhook.';

GRANT ALL ON public.brevo_email_log TO service_role;
GRANT SELECT ON public.brevo_email_log TO authenticated;

ALTER TABLE public.brevo_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read brevo email log"
ON public.brevo_email_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_brevo_email_log_sender ON public.brevo_email_log (sender_email);
CREATE INDEX idx_brevo_email_log_recipient ON public.brevo_email_log (recipient_email);
CREATE INDEX idx_brevo_email_log_sent_at ON public.brevo_email_log (sent_at DESC);
