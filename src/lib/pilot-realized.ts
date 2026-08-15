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
 * MODÈLE DE PÉRIODE CENTRAL (unique dans tout Pilot Pro).
 *
 * - `a_date` (défaut partout) : du 1er janvier jusqu'à AUJOURD'HUI inclus.
 *   Aucune donnée postérieure au jour de consultation n'est comptabilisée,
 *   aucun mois futur n'apparaît dans le réalisé.
 * - `exercice_complet` : lecture intégrale de l'exercice sélectionné, activable
 *   UNIQUEMENT par un choix explicite et visible de l'utilisateur.
 *
 * Une projection reste un objet séparé (`projectYear`, mode « projection ») :
 * elle n'est jamais fusionnée avec le réalisé.
 */
export type PeriodMode = "a_date" | "exercice_complet";

export const DEFAULT_PERIOD_MODE: PeriodMode = "a_date";

export const PERIOD_LABELS: Record<PeriodMode, string> = {
  a_date: "À date",
  exercice_complet: "Exercice complet",
};

/**
 * Options communes à TOUS les calculs du réalisé : mode de lecture et date de
 * référence injectable (tests, rapports antidatés). Aucun moteur ne doit
 * réintroduire son propre `new Date()` : la date de référence descend depuis
 * l'appelant, jusqu'au filtre central ci-dessous.
 */
export interface AsOfOptions {
  mode?: RealProjectionMode;
  now?: Date;
  /** Périmètre temporel demandé par l'écran (défaut : `a_date`). */
  period?: PeriodMode;
}

/**
 * Vrai quand la lecture n'est PAS bornée au jour courant : soit l'utilisateur a
 * explicitement demandé l'exercice complet, soit on lit une projection.
 * Jamais déduit d'une simple sélection d'année.
 */
export function isUnboundedPeriod(options?: AsOfOptions): boolean {
  return options?.mode === "projection" || options?.period === "exercice_complet";
}

/** Libellé visible du périmètre temporel appliqué à un exercice. */
export function periodScopeLabel(
  year: number,
  period: PeriodMode = DEFAULT_PERIOD_MODE,
  now = new Date(),
): string {
  if (period === "exercice_complet") return `Exercice ${year} complet (1er janvier → 31 décembre)`;
  if (year < now.getFullYear()) return `Exercice ${year} clôturé`;
  if (year > now.getFullYear()) return `Exercice ${year} à venir — aucun réalisé`;
  return `Exercice ${year} à date (1er janvier → ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} inclus)`;
}

/** Date comptable unique pour toutes les lignes mensuelles PP. */
export function accountingDateFromYearMonth(year: number, month: number): string {
  return rowDateFromYearMonth(year, month);
}

/** Règle unique Réel / Projection : Réel = date comptable <= aujourd'hui. */
export function isRealizedAccountingDate(
  iso: string | null | undefined,
  now = new Date(),
): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) <= todayIso(now);
}

export function isVisibleInMode(params: {
  date: string | null | undefined;
  mode?: RealProjectionMode;
  now?: Date;
  period?: PeriodMode;
}): boolean {
  if (isUnboundedPeriod(params)) return true;
  return isRealizedAccountingDate(params.date, params.now);
}

/** Vrai si le couple année/mois est déjà réalisé à la date du jour. */
export function isRealizedMonth(year: number, month: number, now = new Date()): boolean {
  return (
    month >= 1 &&
    month <= 12 &&
    isRealizedAccountingDate(accountingDateFromYearMonth(year, month), now)
  );
}

/**
 * FILTRE CENTRAL UNIQUE pour toute ligne mensuelle (charges, heures, ventes
 * agrégées) : en mode réel, seuls les couples année/mois dont la date
 * comptable est ≤ date de référence sont retenus. Les mois futurs de
 * l'exercice en cours sont donc toujours exclus du réalisé.
 */
export function keepRealizedYearMonth(
  row: { year: number; month: number; entry_date?: string | null },
  options?: AsOfOptions,
): boolean {
  if (isUnboundedPeriod(options)) return true;
  // Les lignes de vente/charge qui portent leur date réelle doivent être
  // bornées au JOUR de référence. Le couple année/mois reste le repli pour les
  // sources réellement mensuelles qui ne disposent d'aucune date plus précise.
  if (row.entry_date) return isRealizedAccountingDate(row.entry_date, options?.now);
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
  period: PeriodMode = DEFAULT_PERIOD_MODE,
): T[] {
  return isUnboundedPeriod({ mode, period }) ? entries : realizedEntries(entries, now);
}

/** Lignes de charges réellement constatées à date (exclut les mois futurs). */
export function realizedChargeRows(rows: ChargeRow[], now = new Date()): ChargeRow[] {
  return rows.filter((r) => isRealizedMonth(r.year, r.month, now));
}

export function chargeRowsForMode(
  rows: ChargeRow[],
  mode: RealProjectionMode = "reel",
  now = new Date(),
  period: PeriodMode = DEFAULT_PERIOD_MODE,
): ChargeRow[] {
  return isUnboundedPeriod({ mode, period }) ? rows : realizedChargeRows(rows, now);
}

/** Heures réellement exploitables à date : aucune ligne CA/intervention future. */
export function realizedHoursLedger(
  rows: HoursLedgerEntry[],
  now = new Date(),
): HoursLedgerEntry[] {
  const today = todayIso(now);
  return rows.filter((r) => {
    if (r.date) return isRealizedAccountingDate(r.date, now);
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
  period: PeriodMode = DEFAULT_PERIOD_MODE,
): HoursLedgerEntry[] {
  return isUnboundedPeriod({ mode, period }) ? rows : realizedHoursLedger(rows, now);
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

export function goalsForMode(
  goals: Goal[],
  mode: RealProjectionMode = "reel",
  now = new Date(),
  period: PeriodMode = DEFAULT_PERIOD_MODE,
): Goal[] {
  return isUnboundedPeriod({ mode, period }) ? goals : realizedGoals(goals, now);
}
