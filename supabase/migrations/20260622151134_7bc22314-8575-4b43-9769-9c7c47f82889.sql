CREATE TABLE public.worksite_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  civility text,
  client_name text NOT NULL DEFAULT '',
  client_phone text,
  client_phone_backup text,
  contact_person text,
  address text,
  access_complement text,
  intervention_date date,
  intervenant text,
  client_present boolean,
  green_waste boolean,
  equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
  epi jsonb NOT NULL DEFAULT '[]'::jsonb,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksite_sheets TO authenticated;
GRANT ALL ON public.worksite_sheets TO service_role;

ALTER TABLE public.worksite_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors read own or admin reads all worksite sheets"
ON public.worksite_sheets FOR SELECT TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Editors insert own worksite sheets"
ON public.worksite_sheets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_editor(auth.uid()));

CREATE POLICY "Editors update own or admin updates all worksite sheets"
ON public.worksite_sheets FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Editors delete own or admin deletes all worksite sheets"
ON public.worksite_sheets FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND public.is_editor(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_worksite_sheets_updated_at
BEFORE UPDATE ON public.worksite_sheets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();