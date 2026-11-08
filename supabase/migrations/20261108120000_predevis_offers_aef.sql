-- Pré-devis : source « aef » (catalogue L'Arc en Fleurs, prix pro des petits végétaux).
-- Ajoute la valeur sans toucher aux offres Excel et Henrri existantes.
ALTER TABLE public.predevis_offers DROP CONSTRAINT IF EXISTS predevis_offers_source_check;
ALTER TABLE public.predevis_offers
  ADD CONSTRAINT predevis_offers_source_check CHECK (source IN ('excel', 'henrri', 'aef'));
