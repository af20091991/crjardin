-- Un album ne peut contenir que des photos du même client.
-- La vérification est faite en base (et non seulement dans l'interface) : un album_id fourni
-- par le navigateur est refusé s'il n'appartient pas au client de la photo.
-- Complète la migration 20261119120000 (albums) ; ne modifie pas les données existantes.

create or replace function public.check_photo_album_client()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.album_id is not null and not exists (
    select 1
    from public.client_photo_albums a
    where a.id = new.album_id
      and a.client_id = new.client_id
  ) then
    raise exception 'Album non rattaché à ce client';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_check_photo_album_client on public.intervention_photos;
create trigger trg_check_photo_album_client
  before insert or update of album_id, client_id on public.intervention_photos
  for each row
  execute function public.check_photo_album_client();
