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
  // 1er du mois : un mois EN COURS contient des données comptabilisables
  // (une vente facturée le 12 août 2026 est réelle dès août, sans clôture).
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export type RealProjectionMode = "reel" | "projection";

/**
 * Options communes à TOUS les calculs du réalisé : mode de lecture et date de
 * référence injectable (tests, rapports antidatés). Aucun moteur ne doit
 * réintroduire son propre `new Date()` : la date de référence descend depuis
 * l'appelant, jusqu'au filtre central ci-dessous.
 */
export interface AsOfOptions {
  mode?: RealProjectionMode;
  now?: Date;
}

/** Date comptable unique pour toutes les lignes mensuelles PP. */
export function accountingDateFromYearMonth(year: number, month: number): string {
  return rowDateFromYearMonth(year, month);
}

/** Règle unique Réel / Projection : Réel = date comptable <= aujourd'hui. */
export function isRealizedAccountingDate(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) <= todayIso(now);
}

export function isVisibleInMode(params: {
  date: string | null | undefined;
  mode?: RealProjectionMode;
  now?: Date;
}): boolean {
  if (params.mode === "projection") return true;
  return isRealizedAccountingDate(params.date, params.now);
}

/** Vrai si le couple année/mois est déjà réalisé à la date du jour. */
export function isRealizedMonth(year: number, month: number, now = new Date()): boolean {
  return month >= 1 && month <= 12 && isRealizedAccountingDate(accountingDateFromYearMonth(year, month), now);
}

/**
 * FILTRE CENTRAL UNIQUE pour toute ligne mensuelle (charges, heures, ventes
 * agrégées) : en mode réel, seuls les couples année/mois dont la date
 * comptable est ≤ date de référence sont retenus. Les mois futurs de
 * l'exercice en cours sont donc toujours exclus du réalisé.
 */
export function keepRealizedYearMonth(
  row: { year: number; month: number },
  options?: AsOfOptions,
): boolean {
  if (options?.mode === "projection") return true;
  return isRealizedMonth(row.year, row.month, options?.now);
}

/** Lignes de CA réellement facturées à date (exclut toute date future). */
export function realizedEntries<T extends Pick<PilotEntry, "entry_date">>(
  entries: T[],
  now = new Date(),
): T[] {
  return entries.filter((e) => isRealizedAccountingDate(e.entry_date, now));
}

export function entriesForMode<T extends Pick<PilotEntry, "entry_date">>(
  entries: T[],
  mode: RealProjectionMode = "reel",
  now = new Date(),
): T[] {
  return mode === "projection" ? entries : realizedEntries(entries, now);
}

/** Lignes de charges réellement constatées à date (exclut les mois futurs). */
export function realizedChargeRows(rows: ChargeRow[], now = new Date()): ChargeRow[] {
  return rows.filter((r) => isRealizedMonth(r.year, r.month, now));
}

export function chargeRowsForMode(
  rows: ChargeRow[],
  mode: RealProjectionMode = "reel",
  now = new Date(),
): ChargeRow[] {
  return mode === "projection" ? rows : realizedChargeRows(rows, now);
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

export function hoursLedgerForMode(
  rows: HoursLedgerEntry[],
  mode: RealProjectionMode = "reel",
  now = new Date(),
): HoursLedgerEntry[] {
  return mode === "projection" ? rows : realizedHoursLedger(rows, now);
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

export function goalsForMode(goals: Goal[], mode: RealProjectionMode = "reel", now = new Date()): Goal[] {
  return mode === "projection" ? goals : realizedGoals(goals, now);
}