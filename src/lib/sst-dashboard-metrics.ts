/**
 * Calculs du tableau de bord SST non couverts ailleurs. Aucune donnée inventée : une valeur
 * absente reste null et l'interface affiche « données insuffisantes ».
 */
import type { SstRow } from "@/lib/sst-analytics";
import type { SubcontractorMission } from "@/lib/subcontractors";
import { isAccompanied } from "@/lib/sst-charges";

export interface PriceGap {
  id: string;
  date: string;
  sst: string;
  label: string;
  agreed: number;
  invoiced: number;
  /** facturé − convenu (positif = facturé plus cher que convenu). */
  gap: number;
}

/**
 * Écart entre prix convenu et montant facturé, mission par mission. Ignore les missions
 * accompagnées (leur coût est une charge de chantier) et celles sans l'un des deux montants.
 */
export function priceGaps(rows: SstRow[]): { items: PriceGap[]; total: number; count: number } {
  const items: PriceGap[] = [];
  for (const r of rows) {
    if (isAccompanied(r.mission)) continue;
    const agreed = Number(r.mission.agreed_price ?? 0);
    const invoiced = Number(r.mission.invoiced_amount ?? 0);
    if (agreed <= 0 || invoiced <= 0 || invoiced === agreed) continue;
    items.push({
      id: r.mission.id,
      date: r.mission.mission_date.slice(0, 10),
      sst: r.sstName,
      label: r.mission.prestation || r.mission.service_requested,
      agreed,
      invoiced,
      gap: invoiced - agreed,
    });
  }
  items.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  return { items, total: items.reduce((s, i) => s + i.gap, 0), count: items.length };
}

export interface PrestationRate {
  name: string;
  missions: number;
  hours: number;
  revenue: number;
  cost: number;
  /** Prix de vente HT par heure réalisée par le SST. */
  saleHourly: number;
  /** Coût SST par heure réalisée. */
  costHourly: number;
  marginHourly: number;
}

/**
 * Prix de vente et coût par heure, par prestation. Ne retient que les missions non
 * accompagnées ayant des heures saisies : sinon le coût horaire serait faussé.
 */
export function hourlyByPrestation(rows: SstRow[]): PrestationRate[] {
  const map = new Map<
    string,
    { name: string; missions: number; hours: number; revenue: number; cost: number }
  >();
  for (const r of rows) {
    if (isAccompanied(r.mission)) continue;
    const hours = r.hours ?? 0;
    if (hours <= 0) continue;
    const name = r.mission.prestation || r.mission.service_requested || "Non renseigné";
    const g = map.get(name) ?? { name, missions: 0, hours: 0, revenue: 0, cost: 0 };
    g.missions += 1;
    g.hours += hours;
    g.revenue += r.revenue;
    g.cost += r.cost;
    map.set(name, g);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      saleHourly: g.revenue / g.hours,
      costHourly: g.cost / g.hours,
      marginHourly: (g.revenue - g.cost) / g.hours,
    }))
    .sort((a, b) => b.missions - a.missions);
}

export interface SubcontractorHours {
  name: string;
  missions: number;
  saved: number;
  realized: number;
}

/** Heures économisées (saisies) face aux heures réalisées par le SST, par sous-traitant. */
export function hoursBySubcontractor(rows: SstRow[]): SubcontractorHours[] {
  const map = new Map<string, SubcontractorHours>();
  for (const r of rows) {
    const g = map.get(r.sstName) ?? { name: r.sstName, missions: 0, saved: 0, realized: 0 };
    g.missions += 1;
    g.saved += Number(r.mission.hours_saved ?? r.mission.hours_spent ?? 0);
    g.realized += r.hours ?? 0;
    map.set(r.sstName, g);
  }
  return [...map.values()].sort((a, b) => b.saved - a.saved || b.realized - a.realized);
}

export interface ModeCounts {
  key: string;
  autonome: number;
  chantier: number;
  nonClassee: number;
}

/** Répartition autonome / chantier / non classée, mois par mois (nombre de missions). */
export function monthlyModeMix(rows: SstRow[]): ModeCounts[] {
  const map = new Map<string, ModeCounts>();
  for (const r of rows) {
    const key = r.mission.mission_date.slice(0, 7);
    const g = map.get(key) ?? { key, autonome: 0, chantier: 0, nonClassee: 0 };
    if (r.mission.sst_mode === "autonome") g.autonome += 1;
    else if (isAccompanied(r.mission)) g.chantier += 1;
    else g.nonClassee += 1;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface MonthlyBySubcontractor {
  /** Sous-traitants les plus actifs, puis « Autres » si besoin. */
  subs: string[];
  months: { key: string; counts: Record<string, number> }[];
}

/** Nombre de missions par mois et par sous-traitant ; au-delà de `top`, regroupement en « Autres ». */
export function monthlyBySubcontractor(rows: SstRow[], top = 5): MonthlyBySubcontractor {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.sstName, (totals.get(r.sstName) ?? 0) + 1);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const named = new Set(ranked.slice(0, top));
  const hasOthers = ranked.length > top;
  const subs = hasOthers ? [...ranked.slice(0, top), "Autres"] : ranked.slice(0, top);

  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = r.mission.mission_date.slice(0, 7);
    const bucket = named.has(r.sstName) ? r.sstName : "Autres";
    const counts = map.get(key) ?? {};
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    map.set(key, counts);
  }
  const months = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, counts]) => ({ key, counts }));
  return { subs, months };
}

export interface YearSummary {
  year: number;
  revenue: number;
  cost: number;
  orphan: number;
  margin: number;
  /** Part du CA SST dans le CA total de l'année, si le CA total est connu. */
  shareOfSales: number | null;
}

/**
 * Synthèse annuelle à partir de 2026 : CA et marge des fiches, coût total (fiches + charges
 * sans fiche). `salesByYear` = CA total par année (null si inconnu).
 */
export function yearlySummary(
  rows: SstRow[],
  orphanLines: { year: number; amount: number }[],
  salesByYear: Map<number, number> | null,
  fromYear = 2026,
): YearSummary[] {
  const map = new Map<number, { revenue: number; cost: number; orphan: number }>();
  for (const r of rows) {
    const y = Number(r.mission.mission_date.slice(0, 4));
    if (y < fromYear) continue;
    const g = map.get(y) ?? { revenue: 0, cost: 0, orphan: 0 };
    g.revenue += r.revenue;
    g.cost += r.cost;
    map.set(y, g);
  }
  for (const l of orphanLines) {
    if (l.year < fromYear) continue;
    const g = map.get(l.year) ?? { revenue: 0, cost: 0, orphan: 0 };
    g.orphan += l.amount;
    map.set(l.year, g);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, g]) => {
      const sales = salesByYear?.get(year) ?? 0;
      return {
        year,
        revenue: g.revenue,
        cost: g.cost + g.orphan,
        orphan: g.orphan,
        margin: g.revenue - g.cost,
        shareOfSales: sales > 0 ? (g.revenue / sales) * 100 : null,
      };
    });
}

/** Missions à venir (date ≥ aujourd'hui), non archivées, les plus proches d'abord. */
export function upcomingMissions(
  missions: SubcontractorMission[],
  today: string,
  limit = 6,
): SubcontractorMission[] {
  return missions
    .filter((m) => !m.archived_at && m.mission_date.slice(0, 10) >= today)
    .sort((a, b) => a.mission_date.localeCompare(b.mission_date))
    .slice(0, limit);
}
