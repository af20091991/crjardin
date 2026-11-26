-- ============ Assistant AP ============
CREATE TABLE public.ap_worksites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_label TEXT NOT NULL,
  scheduled_date DATE,
  date_label TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ap_supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worksite_id UUID NOT NULL REFERENCES public.ap_worksites(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL DEFAULT '',
  item TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'a_faire'
    CHECK (status IN ('a_faire','commande_reserve','retrait_livraison_prevu','ok','a_relancer')),
  mode TEXT NOT NULL DEFAULT 'retrait'
    CHECK (mode IN ('retrait','livraison','stock')),
  fulfillment_date DATE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ap_supplies_worksite_idx ON public.ap_supplies(worksite_id);
CREATE INDEX ap_worksites_date_idx ON public.ap_worksites(scheduled_date);

CREATE TABLE public.ap_reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worksite_id UUID NOT NULL REFERENCES public.ap_worksites(id) ON DELETE CASCADE,
  offset_days INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worksite_id, offset_days, recipient_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_worksites TO authenticated;
GRANT ALL ON public.ap_worksites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_supplies TO authenticated;
GRANT ALL ON public.ap_supplies TO service_role;
GRANT SELECT ON public.ap_reminder_log TO authenticated;
GRANT ALL ON public.ap_reminder_log TO service_role;

ALTER TABLE public.ap_worksites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved members read AP worksites" ON public.ap_worksites
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP worksites" ON public.ap_worksites
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP worksites" ON public.ap_worksites
  FOR UPDATE TO authenticated USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members delete AP worksites" ON public.ap_worksites
  FOR DELETE TO authenticated USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members read AP supplies" ON public.ap_supplies
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP supplies" ON public.ap_supplies
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP supplies" ON public.ap_supplies
  FOR UPDATE TO authenticated USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));
CREATE POLICY "Approved members delete AP supplies" ON public.ap_supplies
  FOR DELETE TO authenticated USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Approved members read AP reminder log" ON public.ap_reminder_log
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.ap_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ap_worksites_updated_at BEFORE UPDATE ON public.ap_worksites
  FOR EACH ROW EXECUTE FUNCTION public.ap_set_updated_at();
CREATE TRIGGER ap_supplies_updated_at BEFORE UPDATE ON public.ap_supplies
  FOR EACH ROW EXECUTE FUNCTION public.ap_set_updated_at();

-- ============ Corrections de sécurité (lecture réservée aux comptes validés) ============
DROP POLICY IF EXISTS "Authenticated can read planning notes" ON public.planning_notes;
CREATE POLICY "Approved members read planning notes" ON public.planning_notes
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read referential audit log" ON public.referential_audit_log;
CREATE POLICY "Approved members read referential audit log" ON public.referential_audit_log
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read all garden health" ON public.garden_health;
CREATE POLICY "Approved members read garden health" ON public.garden_health
  FOR SELECT TO authenticated USING (public.is_approved_member(auth.uid()));
