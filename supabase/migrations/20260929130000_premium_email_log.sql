create table if not exists public.premium_email_log (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  recipient_email text not null,
  civility text,
  first_name text,
  last_name text,
  subject text not null,
  premium_url text not null,
  html_body text not null,
  text_body text not null,
  status text not null default 'sent',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists premium_email_log_client_idx
  on public.premium_email_log (client_id, created_at desc);

create index if not exists premium_email_log_sent_at_idx
  on public.premium_email_log (sent_at desc);

grant select on public.premium_email_log to authenticated;
grant all on public.premium_email_log to service_role;

alter table public.premium_email_log enable row level security;

drop policy if exists "Admins can read premium email log" on public.premium_email_log;
create policy "Admins can read premium email log"
on public.premium_email_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Service role manages premium email log" on public.premium_email_log;
create policy "Service role manages premium email log"
on public.premium_email_log
for all
to service_role
using (true)
with check (true);
