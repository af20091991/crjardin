-- Sécurité : la liste des clients ne doit plus être lisible par tout compte connecté.
-- Admin et observateurs : lecture de tous les clients.
-- Sous-traitants (prestataires) : lecture des seuls clients de leurs missions actives.
-- Idempotent.

BEGIN;

DROP POLICY IF EXISTS "Authenticated read all clients" ON public.clients;
DROP POLICY IF EXISTS "Staff et observateurs lisent les clients" ON public.clients;
DROP POLICY IF EXISTS "Sous-traitants lisent les clients de leurs missions" ON public.clients;

CREATE POLICY "Staff et observateurs lisent les clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'observateur')
);

CREATE POLICY "Sous-traitants lisent les clients de leurs missions"
ON public.clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subcontractor_missions m
    JOIN public.subcontractors s ON s.id = m.subcontractor_id
    WHERE m.client_id = clients.id
      AND s.auth_user_id = auth.uid()
      AND s.active = true
  )
);

COMMIT;
