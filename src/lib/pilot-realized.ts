// Règle absolue Pilot Pro : « RÉEL » = uniquement ce qui est terminé et
// facturé à la date du jour. Aucun mois futur, aucune ligne datée après
// aujourd'hui, aucune extrapolation.

import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";

/** Dernier mois clos ou en cours pour l'exercice demandé (1-12). */
export function realizedMonthLimit(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

/** Vrai si le couple année/mois est déjà réalisé à la date du jour. */
export function isRealizedMonth(year: number, month: number, now = new Date()): boolean {
  return month >= 1 && month <= realizedMonthLimit(year, now);
}

/** Lignes de CA réellement facturées à date (exclut toute date future). */
export function realizedEntries<T extends Pick<PilotEntry, "entry_date">>(
  entries: T[],
  now = new Date(),
): T[] {
  const today = now.toISOString().slice(0, 10);
  return entries.filter((e) => String(e.entry_date).slice(0, 10) <= today);
}

/** Lignes de charges réellement constatées à date (exclut les mois futurs). */
export function realizedChargeRows(rows: ChargeRow[], now = new Date()): ChargeRow[] {
  return rows.filter((r) => isRealizedMonth(r.year, r.month, now));
}