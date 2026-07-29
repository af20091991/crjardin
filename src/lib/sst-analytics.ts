// Source unique des indicateurs de rentabilité de la sous-traitance.
// Coût / CA / marge proviennent de la vue v_sst_mission_pnl (déjà partagée avec Pilot Pro).
import type { MissionPnl, Subcontractor, SubcontractorMission } from "@/lib/subcontractors";
import type { RealProjectionMode } from "@/lib/pilot-realized";
import { todayIso } from "@/lib/pilot-realized";

export interface SstRow {
  mission: SubcontractorMission;
  sstName: string;
  clientName: string;
  cost: number;
  revenue: number;
  margin: number;
  marginPct: number | null;
  hours: number | null;
  hourlyCost: number | null;
}

export interface SstTotals {
  missions: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  hours: number;
  hoursSaved: number;
  avgHourlyCost: number | null;
  avgMarginPerMission: number | null;
  missionsWithoutPrice: number;
}

/**
 * Source unique de calcul de la marge d'une mission SST.
 * Marge nette HT = prix HT vente (client_price) − coût SST (invoiced_amount, sinon agreed_price).
 * Ne pas dupliquer cette logique ailleurs dans l'application.
 */
export function computeMissionFinancials(mission: SubcontractorMission): {
  cost: number;
  revenue: number;
  margin: number;
  marginPct: number | null;
  hours: number | null;
  hourlyCost: number | null;
} {
  const cost = Number(mission.invoiced_amount ?? mission.agreed_price ?? 0);
  const revenue = Number(mission.client_price ?? 0);
  const margin = revenue - cost;
  const hours = mission.hours_spent != null ? Number(mission.hours_spent) : null;
  return {
    cost,
    revenue,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    hours,
    hourlyCost: hours && hours > 0 ? cost / hours : null,
  };
}

export function sstRows(params: {
  missions: SubcontractorMission[];
  pnl?: MissionPnl[];
  ssts: Subcontractor[];
  clients: { id: string; name: string }[];
  mode?: RealProjectionMode;
  includeArchived?: boolean;
  year?: number | "all";
}): SstRow[] {
  const { missions, ssts, clients, mode = "reel", includeArchived = false, year = "all" } = params;
  const sstById = new Map(ssts.map((s) => [s.id, s]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const today = todayIso();

  return missions
    .filter((m) => (includeArchived ? true : !m.archived_at))
    .filter((m) => (year === "all" ? true : new Date(m.mission_date).getFullYear() === year))
    .filter((m) => (mode === "reel" ? m.mission_date <= today : true))
    .map((m) => {
      const fin = computeMissionFinancials(m);
      return {
        mission: m,
        sstName: sstById.get(m.subcontractor_id)?.name ?? "—",
        clientName: m.client_id ? (clientById.get(m.client_id)?.name ?? "—") : "—",
        ...fin,
      };
    })
    .sort((a, b) => b.mission.mission_date.localeCompare(a.mission.mission_date));
}

export function sstTotals(rows: SstRow[]): SstTotals {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const margin = revenue - cost;
  const hours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);
  const hoursSaved = rows.reduce(
    (s, r) => s + Number(r.mission.hours_saved ?? r.mission.hours_spent ?? 0),
    0,
  );
  return {
    missions: rows.length,
    revenue,
    cost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    hours,
    hoursSaved,
    avgHourlyCost: hours > 0 ? cost / hours : null,
    avgMarginPerMission: rows.length > 0 ? margin / rows.length : null,
    missionsWithoutPrice: rows.filter((r) => r.revenue <= 0).length,
  };
}

export interface SstGroup {
  key: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  missions: number;
  hours: number;
}

function group(rows: SstRow[], keyOf: (r: SstRow) => string): SstGroup[] {
  const map = new Map<string, SstGroup>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = map.get(key) ?? { key, revenue: 0, cost: 0, margin: 0, marginPct: null, missions: 0, hours: 0 };
    g.revenue += r.revenue;
    g.cost += r.cost;
    g.margin += r.margin;
    g.missions += 1;
    g.hours += r.hours ?? 0;
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, marginPct: g.revenue > 0 ? (g.margin / g.revenue) * 100 : null }))
    .sort((a, b) => b.margin - a.margin);
}

export const bySubcontractor = (rows: SstRow[]) => group(rows, (r) => r.sstName);
export const byPrestation = (rows: SstRow[]) =>
  group(rows, (r) => r.mission.prestation || r.mission.service_requested || "Non renseigné");
export const byClient = (rows: SstRow[]) => group(rows, (r) => r.clientName);

export function byMonth(rows: SstRow[]): SstGroup[] {
  return group(rows, (r) => r.mission.mission_date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
}

export interface SstInsight {
  tone: "positive" | "warning" | "negative";
  title: string;
  detail: string;
}

/** Analyse automatique : uniquement à partir des données saisies. */
export function sstInsights(rows: SstRow[], totals: SstTotals, marginTarget = 25): SstInsight[] {
  const out: SstInsight[] = [];
  if (rows.length === 0) return out;

  const perSst = bySubcontractor(rows);
  const best = perSst.find((g) => g.marginPct != null);
  if (best) {
    out.push({
      tone: "positive",
      title: `Sous-traitant le plus rentable : ${best.key}`,
      detail: `${best.missions} mission(s), marge ${best.margin.toFixed(0)} € (${best.marginPct?.toFixed(1)} %).`,
    });
  }
  const worst = [...perSst].reverse().find((g) => g.marginPct != null);
  if (worst && worst.key !== best?.key) {
    out.push({
      tone: worst.margin < 0 ? "negative" : "warning",
      title: `Marge la plus faible : ${worst.key}`,
      detail: `${worst.missions} mission(s), marge ${worst.margin.toFixed(0)} € (${worst.marginPct?.toFixed(1)} %).`,
    });
  }
  if (totals.marginPct != null && totals.marginPct < marginTarget) {
    out.push({
      tone: "warning",
      title: "Marge globale sous l'objectif",
      detail: `Marge sous-traitance ${totals.marginPct.toFixed(1)} % pour un objectif de ${marginTarget} %. Revoir les prix client ou renégocier les coûts.`,
    });
  }
  const negatives = rows.filter((r) => r.revenue > 0 && r.margin < 0);
  if (negatives.length > 0) {
    out.push({
      tone: "negative",
      title: `${negatives.length} mission(s) à marge négative`,
      detail: negatives
        .slice(0, 3)
        .map((r) => `${r.sstName} — ${r.mission.service_requested} (${r.margin.toFixed(0)} €)`)
        .join(" · "),
    });
  }
  if (totals.missionsWithoutPrice > 0) {
    out.push({
      tone: "warning",
      title: `${totals.missionsWithoutPrice} mission(s) sans prix client`,
      detail: "Renseignez le prix facturé au client pour fiabiliser la marge.",
    });
  }
  if (totals.hoursSaved > 0) {
    out.push({
      tone: "positive",
      title: "Temps dégagé par la sous-traitance",
      detail: `${totals.hoursSaved.toFixed(1)} h libérées sur la période, soit autant de capacité pour vos propres chantiers.`,
    });
  }
  return out;
}