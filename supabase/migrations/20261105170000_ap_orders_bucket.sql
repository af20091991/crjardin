-- Commandes fournisseur (PDF) envoyées par e-mail : bucket privé.
-- Écriture et liens signés uniquement côté serveur (service role) ; aucun accès public.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ap-orders', 'ap-orders', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
