CREATE TABLE public.ap_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  comment text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ap_suppliers_name_unique ON public.ap_suppliers (lower(btrim(name)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_suppliers TO authenticated;
GRANT ALL ON public.ap_suppliers TO service_role;

ALTER TABLE public.ap_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members read AP suppliers" ON public.ap_suppliers
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP suppliers" ON public.ap_suppliers
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP suppliers" ON public.ap_suppliers
  FOR UPDATE TO authenticated USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members delete AP suppliers" ON public.ap_suppliers
  FOR DELETE TO authenticated USING (public.is_approved_member(auth.uid()));

CREATE TRIGGER ap_suppliers_set_updated_at
  BEFORE UPDATE ON public.ap_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.ap_set_updated_at();

ALTER TABLE public.ap_supplies
  ADD COLUMN IF NOT EXISTS quantity text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.ap_suppliers(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Authenticated read intervention reports" ON storage.objects;
CREATE POLICY "Approved members read intervention reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'intervention-reports' AND public.is_approved_member(auth.uid()));