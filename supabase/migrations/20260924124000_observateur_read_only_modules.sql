-- Observer access: compléter la lecture des modules ajoutés après le premier lot.
-- Aucun droit d'écriture n'est accordé.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ap_suppliers',
    'ap_worksites',
    'ap_supplies',
    'pilot_stock_items',
    'pilot_stock_movements',
    'pilot_stock_import_snapshots',
    'calendar_participants',
    'pilot_metric_snapshots'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Observers read all ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''observateur''))',
        'Observers read all ' || t, t
      );
    END IF;
  END LOOP;
END $$;