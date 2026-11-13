-- Accusé de réception des commandes fournisseur envoyées depuis l'Assistant AP.
-- ack_token : jeton du lien « Accuser réception » inclus dans le mail (une valeur par envoi).
-- acknowledged_at : renseigné par la route publique /api/public/ap-order-ack (service role).
ALTER TABLE public.ap_order_sends
  ADD COLUMN IF NOT EXISTS ack_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ap_order_sends_ack_token_idx ON public.ap_order_sends (ack_token);
