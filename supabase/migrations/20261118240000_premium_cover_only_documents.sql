-- Photo de couverture envoyée depuis PP : fichier dédié à la couverture.
-- Il n'apparaît pas dans « Photos et Documents » et est supprimé quand la couverture change.
BEGIN;

ALTER TABLE public.client_premium_documents
  ADD COLUMN IF NOT EXISTS cover_only boolean NOT NULL DEFAULT false;

COMMIT;
