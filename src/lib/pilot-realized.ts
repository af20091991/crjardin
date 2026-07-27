// Règle absolue Pilot Pro : « RÉEL » = uniquement ce qui est terminé et
// facturé à la date du jour. Aucun mois futur, aucune ligne datée après
// aujourd'hui, aucune extrapolation.

import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import type { Goal } from "@/lib/pilot-goals";

/** Dernier mois clos ou en cours pour l'exercice demandé (1-12). */
export function realizedMonthLimit(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function rowDateFromYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-15`;
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
  const today = todayIso(now);
  return entries.filter((e) => String(e.entry_date).slice(0, 10) <= today);
}

/** Lignes de charges réellement constatées à date (exclut les mois futurs). */
export function realizedChargeRows(rows: ChargeRow[], now = new Date()): ChargeRow[] {
  return rows.filter((r) => isRealizedMonth(r.year, r.month, now));
}

/** Heures réellement exploitables à date : aucune ligne CA/intervention future. */
export function realizedHoursLedger(rows: HoursLedgerEntry[], now = new Date()): HoursLedgerEntry[] {
  const today = todayIso(now);
  return rows.filter((r) => {
    if (r.year < now.getFullYear()) return true;
    if (r.year > now.getFullYear()) return false;
    if (r.month == null) return true;
    return rowDateFromYearMonth(r.year, r.month) <= today;
  });
}

/** Objectifs visibles dans le réel : aucun objectif futur ne pénalise le score. */
export function realizedGoals(goals: Goal[], now = new Date()): Goal[] {
  const today = todayIso(now);
  return goals.filter((g) => {
    if (g.completed_date) return g.completed_date.slice(0, 10) <= today;
    if (!g.deadline) return true;
    return g.deadline.slice(0, 10) <= today;
  });
}