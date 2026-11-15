-- Rattachements SST 2026 — lot 2 (validés par l'utilisateur, montants du CA retenus).
-- Idempotent : ne touche que les lignes non rattachées / sans coût renseigné.
--  - Sous-traitance Chauveau (144 €, juin 2026) ↔ mission Chauveau du 19 juin ; coût corrigé à 144 €
--  - SST Guiraud CC (160 €, juin 2026) ↔ mission Guiraud du 23 juin ; coût corrigé à 160 €

update public.pilot_ca_entries set subcontractor_mission_id = '05193508-c779-43bb-9d64-ac2fa896dc5f'
where id = '1e16f425-317c-4362-8649-9e79bbb0915f' and subcontractor_mission_id is null;

update public.subcontractor_missions set invoiced_amount = 144
where id = '05193508-c779-43bb-9d64-ac2fa896dc5f' and invoiced_amount is null;

update public.pilot_ca_entries set subcontractor_mission_id = 'b7bf900e-2a34-4848-860d-154ce5398272'
where id = '52088390-f80f-43d6-8939-99e49a1d4aba' and subcontractor_mission_id is null;

update public.subcontractor_missions set invoiced_amount = 160
where id = 'b7bf900e-2a34-4848-860d-154ce5398272' and invoiced_amount is null;
