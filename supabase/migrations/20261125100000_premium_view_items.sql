-- Suivi détaillé des consultations de l'espace Premium : quel élément le client a ouvert
-- (compte-rendu, photo, document, page). Colonnes ajoutées à la journalisation existante.
alter table public.share_access_log
  add column if not exists item_id text,
  add column if not exists item_label text;
