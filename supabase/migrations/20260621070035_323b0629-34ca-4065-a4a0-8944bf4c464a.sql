CREATE TABLE public.planning_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_date DATE NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_notes TO authenticated;
GRANT ALL ON public.planning_notes TO service_role;

ALTER TABLE public.planning_notes ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read planned notes
CREATE POLICY "Authenticated can read planning notes"
ON public.planning_notes FOR SELECT
TO authenticated
USING (true);

-- Only admins can create/update/delete planned notes
CREATE POLICY "Admins can insert planning notes"
ON public.planning_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update planning notes"
ON public.planning_notes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete planning notes"
ON public.planning_notes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_planning_notes_updated_at
BEFORE UPDATE ON public.planning_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();