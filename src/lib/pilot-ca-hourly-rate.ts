import type { CaEntry } from "@/lib/pilot-ca";

const sum = (rows: CaEntry[], field: "amount_ht" | "hours") =>
  rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

const rate = (ca: number, hours: number) => (hours > 0 ? ca / hours : null);

/**
 * Taux horaire de la carte Chiffre d'affaires.
 * Seules les prestations du mois au statut Réalisé/facturé OU Réglé sont retenues.
 * Une prestation à 0 h reste incluse dans le CA mais n'ajoute aucune heure au dénominateur.
 */
export function monthlyCaHourlyRate(entries: CaEntry[], month: number): number | null {
  const sales = entries.filter(
    (entry) =>
      entry.kind === "vente" &&
      entry.month === month &&
      (entry.sale_status === "realise" || entry.sale_status === "regle"),
  );

  return rate(sum(sales, "amount_ht"), sum(sales, "hours"));
}

/**
 * Compatibilité temporaire avec les anciens appelants : les deux modes
 * retournent désormais exactement la même donnée métier unique.
 */
export type CaHourlyRateMode = "previsionnel" | "en_cours";
export type CaHourlyRates = Record<CaHourlyRateMode, number | null>;

export function monthlyCaHourlyRates(
  entries: CaEntry[],
  month: number,
  _gestionHours: number,
): CaHourlyRates {
  const value = monthlyCaHourlyRate(entries, month);
  return { previsionnel: value, en_cours: value };
}

// Le composant CA historique contient encore le bouton de bascule. Tant que
// ce composant n'est pas refactoré, on masque uniquement ce contrôle obsolète
// pour que l'interface n'expose qu'une seule donnée, sans modifier les autres boutons.
if (typeof document !== "undefined") {
  const styleId = "pilot-ca-hourly-rate-single-value";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      '[title^="Afficher le taux calculé uniquement sur les interventions déjà réglées"],',
      '[title^="Afficher le taux calculé sur toutes les prestations du mois"] { display: none !important; }',
    ].join(" ");
    document.head.appendChild(style);
  }
}
