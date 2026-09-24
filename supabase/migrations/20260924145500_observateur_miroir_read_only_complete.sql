-- Pilot Pro : miroir lecture seule complet pour les comptes observateurs.
-- Les observateurs lisent les données métier de l'entreprise, sans créer/modifier/supprimer.
-- Les données restent rattachées au compte propriétaire ; aucune copie n'est créée.

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
    'contact_sites',
    'pilot_ca_entries',
    'pilot_fixed_charges',
    'pilot_charge_categories',
    'pilot_settings',
    'pilot_goals',
    'pilot_historic_hours',
    'pilot_hours',
    'pilot_tjm_settings',
    'pilot_match_rules',
    'pilot_client_notes',
    'pilot_sst_label_map',
    'ceev_contracts',
    'ceev_agreements',
    'ceev_agreement_events',
    'sst_lists',
    'subcontractors',
    'subcontractor_missions',
    'subcontractor_mission_photos',
    'notifications',
    'services',
    'service_categories',
    'service_prices',
    'service_seasonality',
    'time_categories',
    'time_standards',
    'equipment',
    'equipment_maintenance',
    'equipment_maintenance_schedules',
    'equipment_type_maintenance_types',
    'equipment_types',
    'maintenance_types'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers read all ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''observateur''))',
        'Observers read all ' || t, t
      );

      -- Une policy restrictive est nécessaire sur les tables qui disposent encore
      -- d'une ancienne policy "own" permissive : elle empêche toute écriture
      -- d'un observateur tout en laissant intactes les écritures admin/prestataire.
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot insert ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (NOT public.has_role(auth.uid(), ''observateur''))',
        'Observers cannot insert ' || t, t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot update ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (NOT public.has_role(auth.uid(), ''observateur''))
         WITH CHECK (NOT public.has_role(auth.uid(), ''observateur''))',
        'Observers cannot update ' || t, t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers cannot delete ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING (NOT public.has_role(auth.uid(), ''observateur''))',
        'Observers cannot delete ' || t, t
      );
    END IF;
  END LOOP;
END $$;
