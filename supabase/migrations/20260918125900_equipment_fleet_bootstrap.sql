-- Structure du module Parc matériel, reconstruite à l'identique depuis la base de production.
-- Ce fichier remplace la migration "equipment_fleet" (20260911033530) qui avait été appliquée
-- directement en base sans être versionnée dans le dépôt. Idempotent.

CREATE TABLE IF NOT EXISTS public.equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.maintenance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  interval_months integer NOT NULL,
  reminder_days integer NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'autre',
  custom_category text,
  purchase_date date,
  purchase_cost numeric,
  amortization_years numeric,
  status text NOT NULL DEFAULT 'en_service',
  notes text,
  equipment_type_id uuid REFERENCES public.equipment_types(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_type_maintenance_types (
  equipment_type_id uuid NOT NULL REFERENCES public.equipment_types(id) ON DELETE CASCADE,
  maintenance_type_id uuid NOT NULL REFERENCES public.maintenance_types(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (equipment_type_id, maintenance_type_id)
);

CREATE TABLE IF NOT EXISTS public.equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  cost numeric,
  next_due_date date,
  reminder_sent_at timestamptz,
  maintenance_type_id uuid REFERENCES public.maintenance_types(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  maintenance_type_id uuid NOT NULL REFERENCES public.maintenance_types(id) ON DELETE CASCADE,
  last_completed_date date,
  next_due_date date NOT NULL,
  last_maintenance_id uuid REFERENCES public.equipment_maintenance(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, maintenance_type_id)
);

-- Row Level Security : chaque utilisateur gère ses lignes ; les observateurs lisent tout, sans écrire.
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_type_maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance_schedules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipment_types','maintenance_types','equipment','equipment_type_maintenance_types','equipment_maintenance','equipment_maintenance_schedules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_owner_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers read all ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''observateur''::app_role))', 'Observers read all ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot insert ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), ''observateur''::app_role))', 'Observers cannot insert ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot update ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), ''observateur''::app_role)) WITH CHECK (NOT public.has_role(auth.uid(), ''observateur''::app_role))', 'Observers cannot update ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot delete ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), ''observateur''::app_role))', 'Observers cannot delete ' || t, t);
  END LOOP;
END $$;
