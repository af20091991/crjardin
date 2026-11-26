-- Pilot Pro: module Stock.
-- Le stock est géré en flux (mouvements d'entrée/sortie/ajustement), pas par
-- recomptage périodique : pilot_stock_movements est la source de vérité pour
-- la quantité de chaque article, répercutée sur pilot_stock_items.current_quantity
-- par le trigger ci-dessous. Le module n'est pas relié aux chantiers/interventions
-- pour cette première version (saisie manuelle des mouvements).
-- Accès réservé au rôle admin uniquement (lecture et écriture), à la demande.

create table public.pilot_stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text,
  unit_price_ht numeric(12,4) not null default 0,
  is_perishable boolean not null default false,
  current_quantity numeric(12,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_stock_items_name_key unique (name)
);

comment on column public.pilot_stock_items.current_quantity is
  'Quantité dérivée des mouvements (pilot_stock_movements). Ne jamais écrire cette colonne directement depuis l''application : elle est maintenue par le trigger pilot_stock_apply_movement.';

create index pilot_stock_items_category_idx on public.pilot_stock_items (category);

create trigger pilot_stock_items_updated_at
  before update on public.pilot_stock_items
  for each row execute function public.update_updated_at_column();

create table public.pilot_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pilot_stock_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entree', 'sortie', 'ajustement')),
  quantity numeric(12,4) not null check (quantity <> 0),
  unit_price_ht numeric(12,4),
  reason text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on column public.pilot_stock_movements.quantity is
  'Toujours positive. Le sens (entrée/sortie) est porté par movement_type ; ajustement peut représenter une correction dans un sens ou l''autre selon le contexte saisi.';

create index pilot_stock_movements_item_id_idx on public.pilot_stock_movements (item_id);
create index pilot_stock_movements_occurred_at_idx on public.pilot_stock_movements (occurred_at);

-- Le grand livre des mouvements est immuable : on corrige par un nouveau
-- mouvement d'ajustement, jamais en réécrivant l'historique.
create rule pilot_stock_movements_no_update as on update to public.pilot_stock_movements do instead nothing;
create rule pilot_stock_movements_no_delete as on delete to public.pilot_stock_movements do instead nothing;

create function public.pilot_stock_apply_movement()
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
        when new.movement_type = 'sortie' then -new.quantity
        else new.quantity
      end
  where id = new.item_id;
  return new;
end;
$$;

create trigger pilot_stock_movements_apply
  after insert on public.pilot_stock_movements
  for each row execute function public.pilot_stock_apply_movement();

-- Historique importé (inventaires Excel 2020-2025) : table de référence en
-- lecture seule pour l'application, utilisée pour l'audit et le graphique
-- d'évolution annuelle. N'alimente pas current_quantity.
create table public.pilot_stock_import_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_label text not null,
  category text,
  unit text,
  quantity numeric(12,4),
  unit_price_ht numeric(12,4),
  total_ht numeric(12,4),
  is_perishable boolean,
  observations text,
  snapshot_date date not null,
  source_sheet text not null,
  created_at timestamptz not null default now()
);

create index pilot_stock_import_snapshots_date_idx on public.pilot_stock_import_snapshots (snapshot_date);

alter table public.pilot_stock_items enable row level security;
alter table public.pilot_stock_movements enable row level security;
alter table public.pilot_stock_import_snapshots enable row level security;

create policy "Admin can read stock items"
  on public.pilot_stock_items for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admin can write stock items"
  on public.pilot_stock_items for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admin can read stock movements"
  on public.pilot_stock_movements for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admin can insert stock movements"
  on public.pilot_stock_movements for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admin can read stock import snapshots"
  on public.pilot_stock_import_snapshots for select
  using (public.has_role(auth.uid(), 'admin'));
