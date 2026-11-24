-- Alignement du schéma wdygs sur l'ancien projet Lovable (idempotent).
-- 1. Fonctions utilitaires manquantes
-- 2. Pièces jointes de la messagerie client (table, RLS, validation)
-- 3. Politiques RLS de site_web_connections
-- 4. Triggers updated_at manquants

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_site_web_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_allowed_chat_attachment_mime(p_mime text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  select p_mime = any (array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'application/pdf','text/plain','text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]);
$function$;

CREATE TABLE IF NOT EXISTS public.client_message_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.client_messages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_chat_attachment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare v_msg_client uuid;
begin
  if new.uploaded_by not in ('client','gardener') then raise exception 'Expéditeur invalide'; end if;
  if new.size_bytes <= 0 or new.size_bytes > 10485760 then raise exception 'Fichier trop volumineux (10 Mo maximum)'; end if;
  if not public.is_allowed_chat_attachment_mime(new.mime_type) then raise exception 'Type de fichier non autorisé'; end if;
  select client_id into v_msg_client from public.client_messages where id = new.message_id;
  if v_msg_client is null or v_msg_client <> new.client_id then raise exception 'Message invalide'; end if;
  if new.storage_path not like (new.client_id::text || '/%') then raise exception 'Chemin de fichier invalide'; end if;
  new.filename := left(new.filename, 200);
  return new;
end; $function$;

DROP TRIGGER IF EXISTS client_message_attachments_validate ON public.client_message_attachments;
CREATE TRIGGER client_message_attachments_validate
  BEFORE INSERT ON public.client_message_attachments
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_attachment();

DROP POLICY IF EXISTS "Editors add gardener attachments" ON public.client_message_attachments;
CREATE POLICY "Editors add gardener attachments" ON public.client_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()) AND uploaded_by = 'gardener');

DROP POLICY IF EXISTS "Editors delete chat attachments" ON public.client_message_attachments;
CREATE POLICY "Editors delete chat attachments" ON public.client_message_attachments
  FOR DELETE TO authenticated
  USING (public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "Read chat attachments like messages" ON public.client_message_attachments;
CREATE POLICY "Read chat attachments like messages" ON public.client_message_attachments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'observateur'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_message_attachments.client_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS site_web_connections_select_own ON public.site_web_connections;
CREATE POLICY site_web_connections_select_own ON public.site_web_connections
  FOR SELECT TO authenticated USING ((SELECT auth.uid() AS uid) = user_id);

DROP POLICY IF EXISTS site_web_connections_insert_own ON public.site_web_connections;
CREATE POLICY site_web_connections_insert_own ON public.site_web_connections
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid() AS uid) = user_id);

DROP POLICY IF EXISTS site_web_connections_update_own ON public.site_web_connections;
CREATE POLICY site_web_connections_update_own ON public.site_web_connections
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid() AS uid) = user_id)
  WITH CHECK ((SELECT auth.uid() AS uid) = user_id);

DROP POLICY IF EXISTS site_web_connections_delete_own ON public.site_web_connections;
CREATE POLICY site_web_connections_delete_own ON public.site_web_connections
  FOR DELETE TO authenticated USING ((SELECT auth.uid() AS uid) = user_id);

DROP TRIGGER IF EXISTS site_web_connections_updated_at ON public.site_web_connections;
CREATE TRIGGER site_web_connections_updated_at
  BEFORE UPDATE ON public.site_web_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_site_web_connections_updated_at();

DROP TRIGGER IF EXISTS site_web_watchlist_updated_at ON public.site_web_watchlist;
CREATE TRIGGER site_web_watchlist_updated_at
  BEFORE UPDATE ON public.site_web_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.set_site_web_connections_updated_at();

DROP TRIGGER IF EXISTS trg_equipment_updated_at ON public.equipment;
CREATE TRIGGER trg_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_equipment_maintenance_updated_at ON public.equipment_maintenance;
CREATE TRIGGER trg_equipment_maintenance_updated_at
  BEFORE UPDATE ON public.equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
