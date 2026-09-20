-- Suppression complète de l'ancien module Premium (repart de zéro).
-- Tables, fonctions RPC et policies de storage.
-- Note : le bucket "client-premium" (vide, privé, 0 objet) doit être supprimé
-- manuellement depuis le dashboard Supabase/Lovable : la suppression directe
-- des tables storage.objects/storage.buckets est bloquée par
-- storage.protect_delete() (nécessite l'API Storage, pas du SQL).

drop function if exists public.get_shared_premium_document_url(text, uuid);
drop function if exists public.get_shared_premium(text);

drop policy if exists premium_storage_editor_read on storage.objects;
drop policy if exists premium_storage_editor_insert on storage.objects;
drop policy if exists premium_storage_editor_update on storage.objects;
drop policy if exists premium_storage_editor_delete on storage.objects;
drop policy if exists "Premium editor read" on storage.objects;
drop policy if exists "Premium editor insert" on storage.objects;
drop policy if exists "Premium editor update" on storage.objects;
drop policy if exists "Premium editor delete" on storage.objects;

drop table if exists public.client_premium_planning_items;
drop table if exists public.client_premium_documents;
drop table if exists public.client_premium;
