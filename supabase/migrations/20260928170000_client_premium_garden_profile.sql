-- Client Premium : objectifs et particularités propres au jardin.
alter table public.client_premium
  add column if not exists garden_objectives text,
  add column if not exists garden_specificities text;
