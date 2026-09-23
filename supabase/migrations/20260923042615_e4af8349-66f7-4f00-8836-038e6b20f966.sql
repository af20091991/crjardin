-- Complément fidèle au document « Planning AP 2026-2 ».
-- Les correspondances fournisseur/produit non certaines restent explicitement « À vérifier ».

UPDATE public.ap_supplies s
SET item = 'Plaquette',
    quantity = '3 m³',
    mode = 'livraison',
    status = 'retrait_livraison_prevu',
    comment = 'Document : OUI LIVRAISON 8h30.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Masset paillage + SAV + grimpantes'
  AND s.supplier = 'Berger et fils'
  AND s.item = 'À vérifier';

UPDATE public.ap_supplies s
SET item = 'TV conteneur 35L',
    quantity = 'x10',
    status = 'a_relancer',
    mode = 'livraison',
    comment = 'Document : végétaux AEF, attente VAP 21/09.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Masset paillage + SAV + grimpantes'
  AND s.supplier = 'AEF'
  AND s.item = 'Liste végétaux — attente VAP 09.26';

UPDATE public.ap_supplies s
SET supplier = 'PC, Ruiz ou SJ34',
    item = 'Grimpantes',
    quantity = 'x2 : Jasmin étoilé 200-250 et Solanum 125/150',
    comment = 'Document : fournisseur à vérifier parmi PC, Ruiz ou SJ34 ; état NON.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Masset paillage + SAV + grimpantes'
  AND s.supplier = 'PC'
  AND s.item = 'À vérifier';

WITH missing(worksite_label, supplier, item, quantity, status, mode, fulfillment_date, comment) AS (
  VALUES
    ('Masset paillage + SAV + grimpantes', 'AEF', 'Vivaces', 'x5 en 1,4L', 'a_relancer', 'livraison', NULL::date, 'Document : végétaux AEF, attente VAP 21/09.'),
    ('Masset paillage + SAV + grimpantes', 'AEF', 'Sarcococca', 'x1', 'a_relancer', 'livraison', NULL::date, 'Document : végétaux AEF, attente VAP 21/09.'),
    ('Masset paillage + SAV + grimpantes', 'À vérifier', 'Jonction D16', 'x1', 'a_faire', 'retrait', NULL::date, 'Fournisseur et état non associés avec certitude dans le document : À vérifier.'),
    ('Maurice', 'À vérifier', 'Conteneur 35L', 'x18 dont 1 autre massif', 'a_faire', 'retrait', NULL::date, 'Fournisseur et état non associés avec certitude dans le document : À vérifier.'),
    ('Maurice', 'Truffaut', 'Bulbes', 'x30', 'a_faire', 'retrait', NULL::date, 'Document : fournisseur indiqué « Truffaut (bulbes) » ; état à vérifier.')
)
INSERT INTO public.ap_supplies (
  worksite_id, supplier, item, quantity, status, mode, fulfillment_date, comment
)
SELECT w.id, m.supplier, m.item, m.quantity, m.status, m.mode, m.fulfillment_date, m.comment
FROM missing m
JOIN public.ap_worksites w ON w.client_label = m.worksite_label
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ap_supplies s
  WHERE s.worksite_id = w.id
    AND lower(btrim(s.supplier)) = lower(btrim(m.supplier))
    AND lower(btrim(s.item)) = lower(btrim(m.item))
);

UPDATE public.ap_supplies s
SET item = 'À enterrer L',
    quantity = NULL,
    comment = 'Mention exacte du document ; nature et état à vérifier.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Maurice'
  AND s.supplier = 'Truffaut'
  AND s.item = 'Bulbes à enterrer L';

UPDATE public.ap_supplies s
SET item = 'Conteneur TV', quantity = '25'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Conteneur TV';

UPDATE public.ap_supplies s
SET item = 'Total poids', quantity = '835 kg',
    comment = 'Caractéristique indiquée dans le document ; rattachement fournisseur à vérifier.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Total poids';

UPDATE public.ap_supplies s
SET item = 'Billes argile 50L', quantity = '5'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Billes argile 50L';

UPDATE public.ap_supplies s
SET item = 'Biddim poteries pièce', quantity = '7'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Biddim poteries pièce';

UPDATE public.ap_supplies s
SET item = 'Orgasyl 70L', quantity = '6'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Orgasyl 70L x6';

UPDATE public.ap_supplies s
SET item = 'Amendement 25kg', quantity = '1'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Amendement 25kg x1';

UPDATE public.ap_supplies s
SET item = 'Paillage sarrasin 50L', quantity = '7'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.item = 'Paillage sarrasin 50L x7';

UPDATE public.ap_supplies s
SET comment = concat_ws(' ', NULLIF(s.comment, ''), 'Plantations prévues au document : Giroflée, Sauge, Arbre à Thé, Euphorbe Corse, Vitex, Buddleja, Spirée rose et Liseron Turquie.')
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Chauveau AP'
  AND s.supplier = 'AEF'
  AND s.item LIKE 'Vivaces et arbustes%'
  AND coalesce(s.comment, '') NOT LIKE '%Giroflée%';