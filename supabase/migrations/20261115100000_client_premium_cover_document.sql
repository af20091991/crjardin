-- Couverture Premium : une photo peut provenir des CR chantier (cover_photo_id)
-- ou des documents et photos du client, y compris un envoi depuis le PC
-- (cover_document_id). Une seule des deux colonnes est renseignée à la fois.
alter table public.client_premium
  add column if not exists cover_document_id uuid
  references public.client_premium_documents(id) on delete set null;
