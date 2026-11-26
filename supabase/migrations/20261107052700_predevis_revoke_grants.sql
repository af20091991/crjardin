-- Pré-devis : retire les droits trop larges accordés par défaut.
-- anon : aucun accès. authenticated : pas de TRUNCATE (contourne la RLS), REFERENCES ni TRIGGER.
-- Les admins gardent SELECT, INSERT, UPDATE, DELETE via les politiques RLS.

REVOKE ALL ON public.predevis_suppliers, public.predevis_catalogue_imports,
  public.predevis_products, public.predevis_offers FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.predevis_suppliers,
  public.predevis_catalogue_imports, public.predevis_products, public.predevis_offers FROM authenticated;
