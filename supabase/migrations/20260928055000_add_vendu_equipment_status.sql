-- Ajoute le statut « vendu » au parc matériel.
-- Les valeurs existantes restent inchangées.
alter table public.equipment drop constraint if exists equipment_status_check;
alter table public.equipment
  add constraint equipment_status_check
  check (status = any (array['en_service'::text, 'en_panne'::text, 'en_reparation'::text, 'hors_service'::text, 'vendu'::text]));
