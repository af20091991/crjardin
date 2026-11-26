-- Catalogue AP : arrosage = DMD ; plants 3L à 5L = AEF, PC ou SJ34.
UPDATE public.ap_suppliers SET
  aliases = ARRAY['DMD'],
  catalogue = 'Tout ce qui concerne l''arrosage : goutteurs, capillaire, tuyaux PE, crampons, asperseurs, programmateurs…'
WHERE lower(btrim(name)) = 'dmd';

UPDATE public.ap_suppliers SET
  catalogue = 'Végétaux et vivaces en dessous de 5L ; de 3L à 5L possible aussi (avec PC et SJ34).'
WHERE lower(btrim(name)) = 'aef';

UPDATE public.ap_suppliers SET
  catalogue = 'Arbustes, grimpantes et arbres de 3L à >30L (3L à 5L possible aussi chez AEF et PC). Spécificités : terreau biologique (autre que « professionnel »), terre végétale biologique, arbustes de haie H1, H2 et H3.'
WHERE lower(btrim(name)) = 'sj34';

UPDATE public.ap_suppliers SET
  catalogue = 'Arbustes, grimpantes et arbres de 3L à >30L (3L à 5L possible aussi chez AEF et SJ34). Spécificité : terreau composé (spécifique Pousse-Clanet).'
WHERE lower(btrim(name)) = 'pc';
