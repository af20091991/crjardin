import { supabase } from "@/integrations/supabase/client";
import type { SubcontractorMission } from "@/lib/subcontractors";

/** Statuts de rapprochement qui valent « comptabilisé » pour une mission facturée. */
const ACCOUNTED_STATUSES = new Set(["rattachee", "manuel", "ok", "conforme", "non_applicable"]);

export interface InvoicedMissionToAccount {
  id: string;
  mission_date: string;
  invoiced_amount: number;
  subcontractor_id: string;
  client_id: string | null;
  prestation: string | null;
  service_requested: string;
}

/**
 * Missions déjà facturées (montant facturé renseigné) qui ne sont pas encore rattachées
 * à une ligne comptable (charges ou CA). Ce sont celles à comptabiliser.
 */
/** Exercice suivi pour le rapprochement SST. */
export const RECONCILIATION_YEAR = 2026;

export function findInvoicedMissionsToAccount(
  missions: SubcontractorMission[],
  accountedMissionIds: Set<string>,
  year: number = RECONCILIATION_YEAR,
): InvoicedMissionToAccount[] {
  return missions
    .filter((m) => !m.archived_at && Number(m.invoiced_amount ?? 0) > 0)
    .filter((m) => Number(m.mission_date.slice(0, 4)) === year)
    .filter((m) => !accountedMissionIds.has(m.id))
    .map((m) => ({
      id: m.id,
      mission_date: m.mission_date,
      invoiced_amount: Number(m.invoiced_amount),
      subcontractor_id: m.subcontractor_id,
      client_id: m.client_id,
      prestation: m.prestation,
      service_requested: m.service_requested,
    }))
    .sort((a, b) => a.mission_date.localeCompare(b.mission_date));
}

/** Lignes comptables déjà rattachées à une mission (statut de rapprochement accepté). */
export async function listAccountedMissionIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("subcontractor_mission_id, match_status")
    .not("subcontractor_mission_id", "is", null);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as {
    subcontractor_mission_id: string | null;
    match_status: string;
  }[]) {
    if (row.subcontractor_mission_id && ACCOUNTED_STATUSES.has(row.match_status)) {
      ids.add(row.subcontractor_mission_id);
    }
  }
  return ids;
}
