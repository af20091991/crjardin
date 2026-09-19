-- Pilot Pro authentication is hosted by Lovable's Supabase project, while Site Web
-- data is stored in the dedicated Pilot Pro Supabase project. These user IDs are
-- therefore valid application principals but are not rows in this project's auth.users.
-- Keep ownership at the Edge Function/service-role boundary instead of enforcing
-- a cross-project foreign key that can never be satisfied.

alter table public.site_web_oauth_states
  drop constraint if exists site_web_oauth_states_user_id_fkey;

alter table public.site_web_connections
  drop constraint if exists site_web_connections_user_id_fkey;
