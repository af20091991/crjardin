// Aides pures de présentation du dashboard (Vue année / Vue mois).
// Aucune règle métier : regroupements et variations sur des lignes déjà
// filtrées par les moteurs (entriesForMode, scopedRevenueEntries).

import type { PilotEntry } from "@/lib/pilot";
import { FAMILIES, FAMILY_META } from "@/lib/pilot";

/** Variation en % entre deux valeurs ; null si la base de comparaison est nulle. */
export function variationPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** CA HT du mois jour par jour, avec cumul. `untilDay` borne le cumul (mois en cours). */
export function dailyRevenue(
  entries: PilotEntry[],
  daysInMonth: number,
  untilDay: number,
): Array<{ jour: string; CA: number; cumul: number }> {
  const perDay = new Array<number>(daysInMonth).fill(0);
  for (const entry of entries) {
    const d = new Date(entry.entry_date);
    if (!Number.isFinite(d.getTime())) continue;
    const idx = d.getDate() - 1;
    if (idx >= 0 && idx < daysInMonth) perDay[idx] += Number(entry.amount_ht) || 0;
  }
  const last = Math.min(Math.max(untilDay, 1), daysInMonth);
  let cumul = 0;
  return perDay.slice(0, last).map((value, index) => {
    cumul += value;
    return { jour: String(index + 1), CA: Math.round(value), cumul: Math.round(cumul) };
  });
}

/** Répartition du CA HT par famille (SAP, Aménagement, Conseil) — familles à 0 exclues. */
export function familyBreakdown(
  entries: PilotEntry[],
): Array<{ name: string; value: number; color: string }> {
  return FAMILIES.map((family) => ({
    name: FAMILY_META[family].short,
    color: FAMILY_META[family].color,
    value: Math.round(
      entries
        .filter((entry) => entry.family === family)
        .reduce((sum, entry) => sum + (Number(entry.amount_ht) || 0), 0),
    ),
  })).filter((row) => row.value > 0);
}
