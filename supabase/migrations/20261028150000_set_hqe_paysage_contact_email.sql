-- HQE Paysage : l'adresse de référence est l'adresse professionnelle unique.
-- Le compte Auth de connexion reste contact@hqe-paysage.fr ; cette migration aligne
-- l'adresse de la fiche SST utilisée par les notifications.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.subcontractors
  WHERE lower(btrim(coalesce(company, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(name, ''))) = 'hqe paysage';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Aucune fiche sous-traitant HQE Paysage trouvée : aucune adresse modifiée.';
  ELSIF v_count > 1 THEN
    RAISE EXCEPTION 'Plusieurs fiches HQE Paysage trouvées (%) : correction interrompue pour éviter une modification ambiguë.', v_count;
  END IF;

  UPDATE public.subcontractors
  SET email = 'contact@hqe-paysage.fr',
      updated_at = now()
  WHERE lower(btrim(coalesce(company, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(name, ''))) = 'hqe paysage';
END $$;
