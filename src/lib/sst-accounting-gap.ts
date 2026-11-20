import type { SubcontractorMission } from "@/lib/subcontractors";

/** Exercice suivi pour le rapprochement SST. */
export const RECONCILIATION_YEAR = 2026;

export interface InvoicedMissionWithoutClient {
  id: string;
  mission_date: string;
  invoiced_amount: number;
  subcontractor_id: string;
  prestation: string | null;
  service_requested: string;
}

/**
 * Missions SST facturées de l'exercice qui ne sont rattachées à aucun client.
 * Une mission SST est déjà une charge : seul son rattachement client reste à faire
 * pour l'attribuer à la bonne fiche (marge par client).
 */
export function findInvoicedMissionsWithoutClient(
  missions: SubcontractorMission[],
  year: number = RECONCILIATION_YEAR,
): InvoicedMissionWithoutClient[] {
  return missions
    .filter((m) => !m.archived_at && Number(m.invoiced_amount ?? 0) > 0)
    .filter((m) => Number(m.mission_date.slice(0, 4)) === year)
    .filter((m) => !m.client_id)
    .map((m) => ({
      id: m.id,
      mission_date: m.mission_date,
      invoiced_amount: Number(m.invoiced_amount),
      subcontractor_id: m.subcontractor_id,
      prestation: m.prestation,
      service_requested: m.service_requested,
    }))
    .sort((a, b) => a.mission_date.localeCompare(b.mission_date));
}
