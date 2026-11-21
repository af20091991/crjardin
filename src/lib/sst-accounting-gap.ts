import type { SubcontractorMission } from "@/lib/subcontractors";
import { isSstCharge, linkChargesToMissions } from "@/lib/sst-charges";

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

/** Statut d'une ligne SST saisie dans les charges sans fiche de mission, mais à comptabiliser. */
export const NO_SHEET_STATUS = "sans_fiche";

/** Montant d'une mission SST (coût retenu pour la charge). */
export function sstMissionCost(
  m: Pick<SubcontractorMission, "invoiced_amount" | "agreed_price">,
): number {
  return Number(m.invoiced_amount ?? m.agreed_price ?? 0);
}

export interface SstReconciliationCharge {
  id: string;
  year: number;
  month: number;
  amount_ht: number;
  designation: string | null;
  kind: string;
  is_investment?: boolean | null;
  charge_category?: string | null;
  subcontractor_mission_id?: string | null;
  match_status?: string | null;
  sst_mode?: string | null;
}

export interface SstReconciliation {
  /** Lignes SST de l'exercice sans mission rattachée ni statut « sans fiche ». */
  unlinkedCharges: SstReconciliationCharge[];
  /** Missions SST de l'exercice sans aucune ligne de charge correspondante. */
  missingMissions: SubcontractorMission[];
}

/**
 * Rapprochement SST d'un exercice. Une mission déjà couverte par une charge (rattachement
 * manuel ou correspondance mois + montant) n'apparaît pas dans `missingMissions`.
 * Lecture seule.
 */
export function sstReconciliation(params: {
  charges: SstReconciliationCharge[];
  missions: SubcontractorMission[];
  year?: number;
}): SstReconciliation {
  const { charges, missions, year = RECONCILIATION_YEAR } = params;
  const yearMissions = missions.filter(
    (m) => !m.archived_at && Number(m.mission_date.slice(0, 4)) === year,
  );
  const sstCharges = charges.filter(
    (r) => r.kind === "charge" && !r.is_investment && r.year === year && isSstCharge(r),
  );
  const auto = linkChargesToMissions(
    sstCharges.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      amount: Number(r.amount_ht) || 0,
      manualMissionId: r.subcontractor_mission_id ?? null,
      sstMode: (r.sst_mode as "autonome" | "accompagnee" | null) ?? null,
    })),
    yearMissions,
  );
  const linkedMissionIds = new Set<string>();
  for (const r of sstCharges) {
    if (r.subcontractor_mission_id) linkedMissionIds.add(r.subcontractor_mission_id);
  }
  for (const link of auto.values()) {
    if (link.missionId) linkedMissionIds.add(link.missionId);
  }
  const unlinkedCharges = sstCharges
    .filter(
      (r) =>
        !r.subcontractor_mission_id &&
        !auto.get(r.id)?.missionId &&
        r.match_status !== NO_SHEET_STATUS,
    )
    .sort((a, b) => a.month - b.month);
  const missingMissions = yearMissions
    .filter(
      (m) => sstMissionCost(m) > 0 && m.sst_mode !== "accompagnee" && !linkedMissionIds.has(m.id),
    )
    .sort((a, b) => a.mission_date.localeCompare(b.mission_date));
  return { unlinkedCharges, missingMissions };
}
