-- Liaison Contact <-> Sites (un contact peut couvrir plusieurs sites du même client)
CREATE TABLE public.contact_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  is_report_recipient boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_sites TO authenticated;
GRANT ALL ON public.contact_sites TO service_role;

ALTER TABLE public.contact_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_sites owner" ON public.contact_sites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX contact_sites_unique ON public.contact_sites (contact_id, site_id);
CREATE INDEX contact_sites_site_idx ON public.contact_sites (site_id);

CREATE TRIGGER contact_sites_updated_at
  BEFORE UPDATE ON public.contact_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garde-fou : un contact ne peut être rattaché qu'à un site de SON client
CREATE OR REPLACE FUNCTION public.contact_sites_same_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_contact_client uuid; v_site_client uuid;
BEGIN
  SELECT client_id INTO v_contact_client FROM public.contacts WHERE id = NEW.contact_id;
  SELECT client_id INTO v_site_client FROM public.sites WHERE id = NEW.site_id;
  IF v_contact_client IS NULL OR v_site_client IS NULL OR v_contact_client <> v_site_client THEN
    RAISE EXCEPTION 'Un contact ne peut être rattaché qu''à un site de son propre client';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contact_sites_same_client_check
  BEFORE INSERT OR UPDATE ON public.contact_sites
  FOR EACH ROW EXECUTE FUNCTION public.contact_sites_same_client();

-- Un client ne peut pas avoir deux sites de même nom
CREATE UNIQUE INDEX sites_client_name_unique
  ON public.sites (user_id, client_id, lower(btrim(name)));