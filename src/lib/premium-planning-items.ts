import type { PlanningRow } from "@/lib/file-parser";

export interface PremiumCalendarDraftItem {
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string;
}

const DEFAULT_TITLE = "Entretien du jardin";

/** Convertit les lignes lues dans le PDF en lignes du calendrier Premium, sans IA. */
export function planningRowsToCalendarItems(rows: PlanningRow[]): PremiumCalendarDraftItem[] {
  const seenPerMonth = new Map<number, number>();
  return rows.map((row) => {
    const trailing = Number(row.label.match(/(\d+)\s*$/)?.[1]);
    const count = (seenPerMonth.get(row.month) ?? 0) + 1;
    seenPerMonth.set(row.month, count);
    const base = row.label || row.monthLabel;
    return {
      period_label: row.year && !/\b20\d{2}\b/.test(base) ? `${base} ${row.year}` : base,
      year: row.year,
      month: row.month,
      sequence: Number.isFinite(trailing) && trailing > 0 ? trailing : count,
      title: row.type || DEFAULT_TITLE,
      details: row.tasks.join(" · "),
    };
  });
}

interface DatedItem {
  year: number | null;
  month: number | null;
}

/**
 * Prochaine intervention calée sur la date du jour : la première intervention
 * du mois en cours, sinon la première des mois suivants. Les interventions
 * passées ne sont jamais proposées.
 */
export function pickNextIntervention<T extends DatedItem>(items: T[], now = new Date()): T | null {
  const currentKey = now.getFullYear() * 12 + (now.getMonth() + 1);
  const keyOf = (item: T) =>
    item.month == null ? null : (item.year ?? now.getFullYear()) * 12 + item.month;
  const dated = items
    .map((item) => ({ item, key: keyOf(item) }))
    .filter((entry): entry is { item: T; key: number } => entry.key != null)
    .sort((a, b) => a.key - b.key);
  return dated.find((entry) => entry.key >= currentKey)?.item ?? null;
}
