// ---------------------------------------------------------------------------
// Consolidation d'une fiche client 360° — UNIQUE implémentation.
// La fiche n'agrège plus rien : elle affiche le résultat de cette fonction,
// appelée par le moteur analytique central (pilot-engine · clientView).
// Aucune estimation : uniquement des sommes de données existantes.
// ---------------------------------------------------------------------------

import { sumHistoricHours, type HistoricHoursRow } from "@/lib/pilot-historic-hours";

export interface ClientViewInput {
  clientId: string;
  /** Lignes de vente rattachées (pilot_ca_entries, kind = vente). */
  caRows: Array<{ amount_ht: number | null; designation: string | null; entry_date?: string }>;
  interventions: Array<{
    intervention_date: string;
    status: string;
    hours_spent: number | null;
    sent_to_client_at?: string | null;
  }>;
  historicRows: HistoricHoursRow[];
  ceevRows: Array<{ pv_ht: number | null }>;
  missions: Array<{ client_id: string | null }>;
  /** Score économique central (source unique du CA cumulé quand il existe). */
  scoreRevenueTotalHt?: number | null;
}

export interface ClientView {
  caCumule: number;
  totalHours: number;
  historicHours: number;
  missingHours: number;
  crSent: number;
  crTotal: number;
  hasCrHistory: boolean;
  interventionsWithHours: number;
  ceevValue: number;
  ceevCount: number;
  sstCount: number;
  lastIntervention: string | null;
  lastSale: string | null;
  lastActivity: string | null;
  topDesignations: Array<{ label: string; total: number; n: number }>;
}

export function buildClientView(input: ClientViewInput): ClientView {
  const { caRows, interventions, historicRows, ceevRows, missions } = input;

  const caSum = caRows.reduce((s, r) => s + (Number(r.amount_ht) || 0), 0);
  const caCumule = input.scoreRevenueTotalHt ?? caSum;

  const acc = new Map<string, { total: number; n: number }>();
  for (const r of caRows) {
    const key = (r.designation ?? "—").trim() || "—";
    const cur = acc.get(key) ?? { total: 0, n: 0 };
    cur.total += Number(r.amount_ht) || 0;
    cur.n += 1;
    acc.set(key, cur);
  }
  const topDesignations = Array.from(acc.entries())
    .map(([label, v]) => ({ label, total: v.total, n: v.n }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const crSent = interventions.filter((iv) => iv.sent_to_client_at).length;
  const lastIntervention = interventions[0]?.intervention_date ?? null;
  const lastSale = caRows[0]?.entry_date ?? null;
  const lastActivity =
    lastIntervention && lastSale
      ? lastIntervention > lastSale
        ? lastIntervention
        : lastSale
      : (lastIntervention ?? lastSale ?? null);

  return {
    caCumule,
    totalHours: interventions.reduce((s, iv) => s + (iv.hours_spent ?? 0), 0),
    historicHours: sumHistoricHours(historicRows),
    missingHours: interventions.filter((iv) => iv.status === "terminee" && iv.hours_spent == null).length,
    crSent,
    crTotal: interventions.length,
    hasCrHistory: crSent > 0,
    interventionsWithHours: interventions.filter((iv) => iv.hours_spent != null).length,
    ceevValue: ceevRows.reduce((s, c) => s + (Number(c.pv_ht) || 0), 0),
    ceevCount: ceevRows.length,
    sstCount: missions.filter((m) => m.client_id === input.clientId).length,
    lastIntervention,
    lastSale,
    lastActivity,
    topDesignations,
  };
}
