-- Registre des pages locales préparées par le Radar Visibilité locale (admin uniquement).
create table if not exists public.local_pages (
  id uuid primary key default gen_random_uuid(),
  prestation text not null,
  commune text not null,
  slug text not null unique,
  wp_page_id bigint,
  wp_edit_url text,
  status text not null default 'brouillon',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.local_pages enable row level security;

DROP POLICY IF EXISTS "Admins lisent le registre des pages locales" ON public.local_pages;
CREATE POLICY "Admins lisent le registre des pages locales" ON public.local_pages for select
  using (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins ajoutent au registre des pages locales" ON public.local_pages;
CREATE POLICY "Admins ajoutent au registre des pages locales" ON public.local_pages for insert
  with check (public.has_role(auth.uid(), 'admin') and created_by = auth.uid());

notify pgrst, 'reload schema';
