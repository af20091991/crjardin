-- Store the sender address when Brevo exposes it in webhook events.
-- This allows the admin email tracker to filter by sender as well as recipient.
ALTER TABLE public.brevo_email_log
  ADD COLUMN IF NOT EXISTS sender_email text;

CREATE INDEX IF NOT EXISTS idx_brevo_email_log_sender
  ON public.brevo_email_log (sender_email);
