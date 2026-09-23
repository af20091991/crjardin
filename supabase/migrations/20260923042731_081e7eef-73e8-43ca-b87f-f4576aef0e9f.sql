WITH missing(item) AS (
  VALUES
    ('Giroflée'),
    ('Sauge'),
    ('Arbre à Thé'),
    ('Euphorbe Corse'),
    ('Vitex'),
    ('Buddleja'),
    ('Spirée rose'),
    ('Liseron Turquie')
)
INSERT INTO public.ap_supplies (
  worksite_id, supplier, item, status, mode, fulfillment_date, comment
)
SELECT
  w.id,
  'AEF',
  m.item,
  'a_faire',
  'livraison',
  NULL,
  'Plantation indiquée dans la note Chauveau AP du document ; quantité et état : À vérifier.'
FROM missing m
JOIN public.ap_worksites w ON w.client_label = 'Chauveau AP'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ap_supplies s
  WHERE s.worksite_id = w.id
    AND lower(btrim(s.item)) = lower(btrim(m.item))
);

UPDATE public.ap_supplies s
SET item = 'Bois',
    comment = 'Document : fournisseur Lionel, OUI 05/11 ; retrait prévu le 05/11.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.supplier = 'Lionel'
  AND s.item = 'Bois goutte à goutte';

UPDATE public.ap_supplies s
SET item = 'Goutte à goutte',
    comment = 'Document : fournisseur DMD, NON.'
FROM public.ap_worksites w
WHERE s.worksite_id = w.id
  AND w.client_label = 'Riguet'
  AND s.supplier = 'DMD'
  AND s.item = 'À vérifier';