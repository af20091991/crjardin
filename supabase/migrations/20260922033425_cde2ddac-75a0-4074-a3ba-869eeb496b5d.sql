ALTER TABLE public.sst_availability_calendar
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sst_availability_calendar_subcontractor_idx
  ON public.sst_availability_calendar (subcontractor_id);