-- Observer access: full business visibility without write permissions.
-- Observateurs can read the application data used by the operational and financial
-- modules, while all existing write policies remain restricted to editors/admins.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients',
    'interventions',
    'intervention_tasks',
    'intervention_photos',
    'garden_health',
    'recommendations',
    'client_messages',
    'worksite_sheets',
    'sites',
    'site_aliases',
    'contacts',
    'pilot_ca_entries',
    'pilot_fixed_charges',
    'pilot_charge_categories',
    'pilot_settings',
    'pilot_goals',
    'pilot_historic_hours',
    'pilot_hours',
    'pilot_match_rules',
    'pilot_client_notes',
    'pilot_sst_label_map',
    'ceev_contracts',
    'ceev_agreements',
    'sst_lists',
    'subcontractors',
    'subcontractor_missions',
    'subcontractor_mission_photos'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        'Observers read all ' || t, t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''observateur''))',
        'Observers read all ' || t, t
      );
    END IF;
  END LOOP;
END $$;
