-- HQE Paysage : l'adresse de référence est l'adresse professionnelle unique.
-- Le compte Auth de connexion reste contact@hqe-paysage.fr ; cette migration aligne
-- l'adresse de la fiche SST utilisée par les notifications, y compris si la société
-- est enregistrée sous le nom de la personne plutôt que sous le nom commercial.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.subcontractors
  WHERE lower(btrim(coalesce(company, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(name, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(email, ''))) = 'angelique-burel@outlook.com';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Aucune fiche HQE Paysage / ancienne adresse de notification trouvée : aucune adresse modifiée.';
  ELSIF v_count > 1 THEN
    RAISE EXCEPTION 'Plusieurs fiches correspondent à HQE Paysage ou à l''ancienne adresse (%) : correction interrompue pour éviter une modification ambiguë.', v_count;
  END IF;

  UPDATE public.subcontractors
  SET email = 'contact@hqe-paysage.fr',
      updated_at = now()
  WHERE lower(btrim(coalesce(company, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(name, ''))) = 'hqe paysage'
     OR lower(btrim(coalesce(email, ''))) = 'angelique-burel@outlook.com';
END $$;
