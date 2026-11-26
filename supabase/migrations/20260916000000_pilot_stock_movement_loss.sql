-- Pilot Pro: ajoute un type de mouvement "perte" au module Stock, pour
-- déclarer un article perdu ou périmé sans le confondre avec une sortie
-- normale (vente/usage chantier).
alter table public.pilot_stock_movements
  drop constraint if exists pilot_stock_movements_movement_type_check;

alter table public.pilot_stock_movements
  add constraint pilot_stock_movements_movement_type_check
  check (movement_type in ('entree', 'sortie', 'ajustement', 'perte'));

-- Le trigger d'origine traitait tout ce qui n'est pas 'entree'/'sortie' comme
-- un ajustement signé (+new.quantity). Sans ce correctif, une "perte"
-- augmenterait le stock au lieu de le diminuer.
create or replace function public.pilot_stock_apply_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pilot_stock_items
  set current_quantity = current_quantity
    + case
        when new.movement_type = 'entree' then new.quantity
        when new.movement_type in ('sortie', 'perte') then -new.quantity
        else new.quantity
      end
  where id = new.item_id;
  return new;
end;
$$;
