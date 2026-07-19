
-- 1. subcontractors
CREATE TABLE public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate NUMERIC(10,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractors TO authenticated;
GRANT ALL ON public.subcontractors TO service_role;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_owner_all" ON public.subcontractors FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_subcontractors_user ON public.subcontractors(user_id);

-- 2. subcontractor_missions
CREATE TABLE public.subcontractor_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  worksite_sheet_id UUID REFERENCES public.worksite_sheets(id) ON DELETE SET NULL,
  mission_date DATE NOT NULL,
  service_requested TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','done','done_with_issues','problem','impossible')),
  report_notes TEXT,
  anomalies TEXT,
  recommendations TEXT,
  agreed_price NUMERIC(10,2),
  invoiced_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_missions TO authenticated;
GRANT ALL ON public.subcontractor_missions TO service_role;
ALTER TABLE public.subcontractor_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_mission_owner_all" ON public.subcontractor_missions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sst_missions_user ON public.subcontractor_missions(user_id);
CREATE INDEX idx_sst_missions_sst ON public.subcontractor_missions(subcontractor_id);
CREATE INDEX idx_sst_missions_client ON public.subcontractor_missions(client_id);
CREATE INDEX idx_sst_missions_date ON public.subcontractor_missions(mission_date DESC);

-- 3. subcontractor_mission_photos
CREATE TABLE public.subcontractor_mission_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.subcontractor_missions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  kind TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('briefing','report')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_mission_photos TO authenticated;
GRANT ALL ON public.subcontractor_mission_photos TO service_role;
ALTER TABLE public.subcontractor_mission_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sst_mission_photo_owner_all" ON public.subcontractor_mission_photos FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sst_photos_mission ON public.subcontractor_mission_photos(mission_id);

-- Triggers updated_at (réutilise fonction existante update_updated_at_column)
CREATE TRIGGER trg_subcontractors_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sst_missions_updated_at
  BEFORE UPDATE ON public.subcontractor_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
