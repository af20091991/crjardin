-- Rattachements SST 2026 — lot 1 (validés par l'utilisateur).
-- Idempotent : ne touche que les lignes encore non rattachées / sans coût renseigné.
--  - Chloé Ndiaye (112 €, mai 2026) ↔ mission Ndiaye
--  - Chloé Condorcet (112 €, mai 2026) ↔ mission « Condorcet haie »
--  - SST HQE Mesuré (64 €, mai 2026) ↔ mission Mesuré ; coût corrigé à 64 € (montant CA retenu)

update public.pilot_ca_entries set subcontractor_mission_id = '8db86c9f-d974-445a-b4dd-aab9bbc36560'
where id = '4a6d1117-bf3f-414a-806b-9c5a2da5c582' and subcontractor_mission_id is null;

update public.pilot_ca_entries set subcontractor_mission_id = '700f88de-5520-4cab-a1c6-008d9ca3953b'
where id = 'a100b477-4a75-4a5a-878e-0943c431bf86' and subcontractor_mission_id is null;

update public.pilot_ca_entries set subcontractor_mission_id = '9c5d3de0-c23c-430a-83b3-be772d376500'
where id = '0c1ec596-c0a4-4284-b2d9-daacb8aa961b' and subcontractor_mission_id is null;

update public.subcontractor_missions set invoiced_amount = 64
where id = '9c5d3de0-c23c-430a-83b3-be772d376500' and invoiced_amount is null;
