// Helpers de formatage partagés (euros, pourcentages, heures).
// Re-exports au-dessus de `@/lib/pilot` pour éviter les duplications.
export { formatEuro, formatPct } from "@/lib/pilot";

export function formatHours(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)} h`;
}

export function formatHourlyRate(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)}/h`;
}

export function formatRatio(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)} %`;
}