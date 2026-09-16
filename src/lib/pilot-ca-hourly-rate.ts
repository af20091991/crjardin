import type { CaEntry } from "@/lib/pilot-ca";

export type CaHourlyRateMode = "previsionnel" | "en_cours";

export type CaHourlyRates = Record<CaHourlyRateMode, number | null>;

const sum = (rows: CaEntry[], field: "amount_ht" | "hours") =>
  rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

const rate = (ca: number, hours: number) => (hours > 0 ? ca / hours : null);

/**
 * Taux horaire de la page CA : le temps de gestion déclaré est toujours inclus.
 * Prévisionnel = toutes les prestations du mois, quel que soit leur statut.
 * En cours = uniquement les prestations déjà réglées du mois.
 */
export function monthlyCaHourlyRates(
  entries: CaEntry[],
  month: number,
  gestionHours: number,
): CaHourlyRates {
  const sales = entries.filter((entry) => entry.kind === "vente" && entry.month === month);
  const paidSales = sales.filter((entry) => entry.sale_status === "regle");
  const gestion = Math.max(0, Number(gestionHours) || 0);

  return {
    previsionnel: rate(sum(sales, "amount_ht"), sum(sales, "hours") + gestion),
    en_cours: rate(sum(paidSales, "amount_ht"), sum(paidSales, "hours") + gestion),
  };
}
