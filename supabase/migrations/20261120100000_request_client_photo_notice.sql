-- Demande de notification client après un ajout massif de photos.
-- La notification passe par la file de validation existante (client_notifications, statut pending) :
-- l'administrateur la valide, puis e-mail et notification partent comme pour les autres types.
create or replace function public.request_client_photo_notice(p_client uuid, p_count integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'Nombre de photos invalide';
  end if;
  insert into public.client_notifications (client_id, kind, title, body, source_key)
  values (
    p_client,
    'photos',
    'Nouvelles photos de votre jardin',
    p_count || ' nouvelle' || case when p_count > 1 then 's' else '' end
      || ' photo' || case when p_count > 1 then 's ont' else ' a' end
      || ' été ajoutée' || case when p_count > 1 then 's' else '' end || ' à votre espace.',
    'photos:' || p_client::text || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text
  );
end $$;

revoke all on function public.request_client_photo_notice(uuid, integer) from public;
grant execute on function public.request_client_photo_notice(uuid, integer) to authenticated;
