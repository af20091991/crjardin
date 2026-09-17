import type { CaEntry } from "@/lib/pilot-ca";

export type CaHourlyRateMode = "previsionnel" | "en_cours";

export type CaHourlyRates = Record<CaHourlyRateMode, number | null>;

const sum = (rows: CaEntry[], field: "amount_ht" | "hours") =>
  rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

const rate = (ca: number, hours: number) => (hours > 0 ? ca / hours : null);

/**
 * Taux horaire de la page CA.
 * Prévisionnel = toutes les prestations du mois, quel que soit leur statut,
 * avec le temps de gestion déclaré inclus.
 * En cours = uniquement les prestations du mois dont un temps est réellement
 * renseigné, avec le CA de ces mêmes prestations et sans temps de gestion ajouté.
 */
export function monthlyCaHourlyRates(
  entries: CaEntry[],
  month: number,
  gestionHours: number,
): CaHourlyRates {
  const sales = entries.filter((entry) => entry.kind === "vente" && entry.month === month);
  const timedSales = sales.filter((entry) => (Number(entry.hours) || 0) > 0);
  const gestion = Math.max(0, Number(gestionHours) || 0);

  return {
    previsionnel: rate(sum(sales, "amount_ht"), sum(sales, "hours") + gestion),
    en_cours: rate(sum(timedSales, "amount_ht"), sum(timedSales, "hours")),
  };
}
