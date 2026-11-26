-- Comptabilisation SST : une ligne de charge sous-traitance du Chiffre d'affaires
-- peut être rattachée à UNE mission SST, par identifiant (jamais par montant).
-- Idempotent : peut être rejoué sans effet.
alter table public.pilot_ca_entries
  add column if not exists subcontractor_mission_id uuid
  references public.subcontractor_missions(id) on delete set null;

create unique index if not exists pilot_ca_entries_subcontractor_mission_uidx
  on public.pilot_ca_entries (subcontractor_mission_id)
  where subcontractor_mission_id is not null;
