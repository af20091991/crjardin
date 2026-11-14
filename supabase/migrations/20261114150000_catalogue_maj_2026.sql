-- Catalogue 2026 : mise à jour de prix (Terreau Orgasyl, TVC35) et 13 nouveaux articles.
-- Idempotent : relançable sans doublon.

-- 1. Prix modifiés : l'offre Excel prime sur Henrri, les deux sont alignées.
UPDATE public.predevis_offers o
SET pau_ht = v.pau, pau_raw = v.pau::text
FROM public.predevis_products p,
     (VALUES ('T4', 18.15::numeric), ('TVC35', 1.225::numeric)) AS v(code, pau)
WHERE o.product_id = p.id AND p.code = v.code AND o.source IN ('excel', 'henrri');

-- 2. Nouveaux articles (produit + offre Excel).
WITH src(code, designation, norm_designation, unit, supplier_id, pau) AS (VALUES
  ('PLAC35L', 'Plaquette forestière 35L', 'plaquette forestiere 35l', 'pièce', 'bd7378a8-033d-40b9-895d-482b363642ed'::uuid, 1.925::numeric),
  ('PLAV', 'Plaquette forestière m3', 'plaquette forestiere m3', 'm3', 'bd7378a8-033d-40b9-895d-482b363642ed'::uuid, 55::numeric),
  ('Am1', 'Végévert - kg', 'vegevert - kg', 'kg', 'd56dc3b9-6ac2-4671-912e-4078a809f627'::uuid, 0.7::numeric),
  ('Am2', 'Végévert - sac', 'vegevert - sac', 'pièce', 'd56dc3b9-6ac2-4671-912e-4078a809f627'::uuid, 17.48::numeric),
  ('En2', 'Engrais azoté biologique', 'engrais azote biologique', 'kg', '81c1549c-573c-43c9-8bf6-a93647d62ed3'::uuid, 1.36::numeric),
  ('Mo', 'Flamme d''ardoise', 'flamme d''ardoise', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 433.3::numeric),
  ('Tr0', 'Traverse 240 chêne déclassée', 'traverse 240 chene declassee', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 21.475::numeric),
  ('Tr1', 'Traverse 240 chêne (traitée)', 'traverse 240 chene (traitee)', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 42.95::numeric),
  ('Tr2', 'Traverse chêne 200 traitée', 'traverse chene 200 traitee', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 35.55::numeric),
  ('Tr4', 'Nidagravel 60mm x 1,9m longueur', 'nidagravel 60mm x 1,9m longueur', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 22.55::numeric),
  ('Tr9', 'Traverse traitée chêne 130', 'traverse traitee chene 130', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 21.9::numeric),
  ('Tr13', 'Nidaborder Corten 10x190cm', 'nidaborder corten 10x190cm', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 48.5::numeric),
  ('Tr14', 'Nidaborder Galva 60mmx190cm', 'nidaborder galva 60mmx190cm', 'pièce', '23bd6c4d-483d-4e8d-939f-6e263c4ce6f9'::uuid, 22.55::numeric)
),
ins AS (
  INSERT INTO public.predevis_products (norm_code, code, designation, norm_designation, unit, family)
  SELECT s.code, s.code, s.designation, s.norm_designation, s.unit, 'Produits'
  FROM src s
  WHERE NOT EXISTS (SELECT 1 FROM public.predevis_products p WHERE p.code = s.code)
  RETURNING id, code
)
INSERT INTO public.predevis_offers (product_id, supplier_id, source, pau_ht)
SELECT ins.id, s.supplier_id, 'excel', s.pau
FROM src s JOIN ins ON ins.code = s.code;
