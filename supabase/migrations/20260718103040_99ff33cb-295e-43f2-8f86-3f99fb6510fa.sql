
-- Enable btree_gist for EXCLUDE constraints with uuid + daterange
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. CATALOGUE PRESTATIONS
-- ============================================================

CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  color text,
  position int NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.service_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.service_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.service_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.service_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_service_categories_updated BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  unit text NOT NULL,
  standard_duration_hours numeric(6,2),
  default_frequency text,
  is_recurring boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
CREATE INDEX idx_services_category ON public.services(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.services FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.services FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  price_ht numeric(12,2) NOT NULL,
  material_cost numeric(12,2) NOT NULL DEFAULT 0,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (
    service_id WITH =,
    daterange(valid_from, COALESCE(valid_to, DATE '9999-12-31'), '[)') WITH &&
  )
);
CREATE INDEX idx_service_prices_service ON public.service_prices(service_id, valid_from DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_prices TO authenticated;
GRANT ALL ON public.service_prices TO service_role;
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.service_prices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.service_prices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.service_prices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.service_prices FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.service_seasonality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category','service')),
  category_id uuid REFERENCES public.service_categories(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  intensity numeric(4,2) NOT NULL DEFAULT 1 CHECK (intensity >= 0 AND intensity <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'category' AND category_id IS NOT NULL AND service_id IS NULL) OR
    (scope = 'service'  AND service_id  IS NOT NULL AND category_id IS NULL)
  )
);
CREATE UNIQUE INDEX idx_seasonality_cat ON public.service_seasonality(user_id, category_id, month) WHERE scope='category';
CREATE UNIQUE INDEX idx_seasonality_srv ON public.service_seasonality(user_id, service_id, month)  WHERE scope='service';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_seasonality TO authenticated;
GRANT ALL ON public.service_seasonality TO service_role;
ALTER TABLE public.service_seasonality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.service_seasonality FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.service_seasonality FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.service_seasonality FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.service_seasonality FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_service_seasonality_updated BEFORE UPDATE ON public.service_seasonality FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. REFERENTIEL TEMPS
-- ============================================================

CREATE TABLE public.time_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  is_billable boolean NOT NULL DEFAULT false,
  color text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_categories TO authenticated;
GRANT ALL ON public.time_categories TO service_role;
ALTER TABLE public.time_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.time_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.time_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.time_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.time_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_time_categories_updated BEFORE UPDATE ON public.time_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.time_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_category_id uuid NOT NULL REFERENCES public.time_categories(id) ON DELETE CASCADE,
  target_ratio numeric(5,4) NOT NULL CHECK (target_ratio >= 0 AND target_ratio <= 1),
  hours_per_day numeric(4,2) NOT NULL DEFAULT 8,
  working_days_per_year int NOT NULL DEFAULT 220,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (
    time_category_id WITH =,
    daterange(valid_from, COALESCE(valid_to, DATE '9999-12-31'), '[)') WITH &&
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_standards TO authenticated;
GRANT ALL ON public.time_standards TO service_role;
ALTER TABLE public.time_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.time_standards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.time_standards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.time_standards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.time_standards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 3. REFERENTIEL CHARGES
-- ============================================================

CREATE TABLE public.charge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fixe','variable','vehicule','materiel','autre')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charge_categories TO authenticated;
GRANT ALL ON public.charge_categories TO service_role;
ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.charge_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.charge_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.charge_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.charge_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_charge_categories_updated BEFORE UPDATE ON public.charge_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.charges_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  amount_ht numeric(12,2) NOT NULL,
  periodicity text NOT NULL CHECK (periodicity IN ('mensuel','trimestriel','semestriel','annuel')),
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX idx_charges_recurring_cat ON public.charges_recurring(charge_category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges_recurring TO authenticated;
GRANT ALL ON public.charges_recurring TO service_role;
ALTER TABLE public.charges_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.charges_recurring FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.charges_recurring FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.charges_recurring FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.charges_recurring FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_charges_recurring_updated BEFORE UPDATE ON public.charges_recurring FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.charges_variable_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  unit text NOT NULL,
  amount_per_unit numeric(12,4) NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges_variable_rates TO authenticated;
GRANT ALL ON public.charges_variable_rates TO service_role;
ALTER TABLE public.charges_variable_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.charges_variable_rates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.charges_variable_rates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.charges_variable_rates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.charges_variable_rates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.charges_one_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_category_id uuid NOT NULL REFERENCES public.charge_categories(id) ON DELETE RESTRICT,
  label text NOT NULL,
  amount_ht numeric(12,2) NOT NULL,
  purchase_date date NOT NULL,
  amortization_months int CHECK (amortization_months IS NULL OR amortization_months > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_charges_one_off_cat ON public.charges_one_off(charge_category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges_one_off TO authenticated;
GRANT ALL ON public.charges_one_off TO service_role;
ALTER TABLE public.charges_one_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read"   ON public.charges_one_off FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.charges_one_off FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.charges_one_off FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.charges_one_off FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_charges_one_off_updated BEFORE UPDATE ON public.charges_one_off FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. VUES SQL — Moteur de calcul (SECURITY INVOKER via default)
-- ============================================================

CREATE OR REPLACE VIEW public.v_service_current_price
WITH (security_invoker = true) AS
SELECT DISTINCT ON (service_id)
  user_id, service_id, price_ht, material_cost, tva_rate, valid_from
FROM public.service_prices
WHERE valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to > CURRENT_DATE)
ORDER BY service_id, valid_from DESC;

CREATE OR REPLACE VIEW public.v_service_seasonality_resolved
WITH (security_invoker = true) AS
SELECT s.user_id, s.id AS service_id, m.month,
       COALESCE(ss_srv.intensity, ss_cat.intensity, 1) AS intensity
FROM public.services s
CROSS JOIN generate_series(1,12) AS m(month)
LEFT JOIN public.service_seasonality ss_srv
  ON ss_srv.scope='service' AND ss_srv.service_id=s.id AND ss_srv.month=m.month
LEFT JOIN public.service_seasonality ss_cat
  ON ss_cat.scope='category' AND ss_cat.category_id=s.category_id AND ss_cat.month=m.month;

CREATE OR REPLACE VIEW public.v_charges_monthly
WITH (security_invoker = true) AS
SELECT user_id,
  SUM(CASE periodicity
        WHEN 'mensuel' THEN amount_ht
        WHEN 'trimestriel' THEN amount_ht/3
        WHEN 'semestriel' THEN amount_ht/6
        WHEN 'annuel' THEN amount_ht/12
      END) AS monthly_recurring
FROM public.charges_recurring
WHERE valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to > CURRENT_DATE)
GROUP BY user_id;

CREATE OR REPLACE VIEW public.v_billable_hours_target
WITH (security_invoker = true) AS
SELECT ts.user_id,
       SUM(ts.target_ratio * ts.hours_per_day * ts.working_days_per_year)
         FILTER (WHERE tc.is_billable) AS billable_hours_year
FROM public.time_standards ts
JOIN public.time_categories tc ON tc.id = ts.time_category_id
WHERE ts.valid_from <= CURRENT_DATE AND (ts.valid_to IS NULL OR ts.valid_to > CURRENT_DATE)
GROUP BY ts.user_id;

CREATE OR REPLACE VIEW public.v_real_hourly_cost
WITH (security_invoker = true) AS
SELECT c.user_id,
       (c.monthly_recurring * 12) / NULLIF(h.billable_hours_year, 0) AS real_hourly_cost
FROM public.v_charges_monthly c
LEFT JOIN public.v_billable_hours_target h ON h.user_id = c.user_id;

CREATE OR REPLACE VIEW public.v_service_margin
WITH (security_invoker = true) AS
SELECT s.user_id, s.id AS service_id, s.label, s.unit, s.standard_duration_hours,
       p.price_ht, p.material_cost,
       rhc.real_hourly_cost,
       (p.price_ht
         - p.material_cost
         - COALESCE(s.standard_duration_hours,0) * COALESCE(rhc.real_hourly_cost,0)
       ) AS gross_margin
FROM public.services s
JOIN public.v_service_current_price p ON p.service_id = s.id
LEFT JOIN public.v_real_hourly_cost rhc ON rhc.user_id = s.user_id;
