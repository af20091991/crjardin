CREATE TABLE public.pilot_sst_label_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  raw_label text NOT NULL,
  subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  provider_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, raw_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_sst_label_map TO authenticated;
GRANT ALL ON public.pilot_sst_label_map TO service_role;

ALTER TABLE public.pilot_sst_label_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own SST label map"
ON public.pilot_sst_label_map FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pilot_sst_label_map_updated_at
BEFORE UPDATE ON public.pilot_sst_label_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();