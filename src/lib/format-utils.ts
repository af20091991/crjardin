// Helpers de formatage partagés (euros, pourcentages, heures) — SOURCE UNIQUE d'affichage.
// Règles : séparateur décimal français (virgule), « — » quand la valeur est absente,
// pourcentages et heures avec au plus une décimale (« 12,5 % », « 13 % », « 7,5 h »).
export { formatEuro, formatPct } from "@/lib/pilot";

const frNumber = (n: number, maxDigits: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  }).format(n);

export function formatHours(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${frNumber(n, digits)} h`;
}

/** Pourcentage « tel quel » (12,5 → « 12,5 % »), au plus `digits` décimales. */
export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${frNumber(n, digits)} %`;
}

export function formatHourlyRate(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)}/h`;
}

export function formatRatio(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPercent(n * 100, digits);
}

/** Entier / compteur au format français (« 12 345 »). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/** Part exprimée en ratio (0,125 → « 12,5 % »), une décimale maximum. */
export function formatShare(ratio: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    ratio,
  );
}
