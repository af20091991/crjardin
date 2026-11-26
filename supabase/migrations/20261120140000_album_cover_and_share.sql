-- Albums : photo de couverture et lien de partage révocable.
alter table public.client_photo_albums
  add column if not exists cover_photo_id uuid references public.intervention_photos(id) on delete set null,
  add column if not exists share_token uuid unique;
