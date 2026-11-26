-- La lecture des clients par les observateurs est déjà couverte par « Staff et observateurs lisent les clients ».
BEGIN;

DROP POLICY IF EXISTS "Observers read all clients" ON public.clients;

COMMIT;
