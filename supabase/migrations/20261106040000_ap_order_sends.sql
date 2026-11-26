-- Journal des commandes fournisseur envoyées par e-mail depuis l'Assistant AP.
CREATE TABLE IF NOT EXISTS public.ap_order_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksite_id uuid REFERENCES public.ap_worksites(id) ON DELETE SET NULL,
  worksite_label text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.ap_suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  recipient_email text NOT NULL,
  pdf_path text,
  message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'suppressed', 'failed')),
  error_message text,
  sent_by uuid NOT NULL DEFAULT auth.uid(),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ap_order_sends_worksite_idx ON public.ap_order_sends (worksite_id, sent_at DESC);

GRANT SELECT, INSERT ON public.ap_order_sends TO authenticated;
GRANT ALL ON public.ap_order_sends TO service_role;

ALTER TABLE public.ap_order_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members read AP order sends" ON public.ap_order_sends
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP order sends" ON public.ap_order_sends
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_member(auth.uid()) AND sent_by = auth.uid());
