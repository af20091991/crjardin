import type { AnnualRow } from "@/lib/pilot-annual";
import type { Goal } from "@/lib/pilot-goals";

export type HistoricalReference = {
  value: number | null;
  label: string;
  years: number[];
};

/**
 * Repère personnel : médiane des exercices complets réellement présents.
 * Aucun seuil métier générique et aucune projection ne sont utilisés.
 */
export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function historicalReference(
  rows: AnnualRow[],
  selector: (row: AnnualRow) => number | null,
): HistoricalReference {
  const complete = rows.filter((row) => row.chargesComplete);
  const values = complete.map(selector).filter((value): value is number => value != null && Number.isFinite(value));
  return {
    value: median(values),
    label: complete.length ? `Médiane de ${complete.length} exercice${complete.length > 1 ? "s" : ""} complet${complete.length > 1 ? "s" : ""}` : "Pas d'historique exploitable",
    years: complete.map((row) => row.year).sort((a, b) => a - b),
  };
}

export type GoalHealth = {
  active: Goal[];
  done: Goal[];
  late: Goal[];
  completionRate: number | null;
};

export function goalHealth(goals: Goal[], todayIso: string): GoalHealth {
  const active = goals.filter((goal) => goal.status !== "abandonne");
  const done = active.filter((goal) => goal.status === "termine");
  const late = active.filter(
    (goal) => goal.status === "en_cours" && goal.deadline != null && goal.deadline.slice(0, 10) < todayIso,
  );
  return {
    active,
    done,
    late,
    completionRate: active.length ? (done.length / active.length) * 100 : null,
  };
}
