DROP INDEX IF EXISTS public.sst_availability_calendar_subcontractor_idx;

ALTER TABLE public.sst_availability_calendar
  DROP COLUMN IF EXISTS subcontractor_id;