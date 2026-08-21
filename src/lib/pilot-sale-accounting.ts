// ---------------------------------------------------------------------------
// RÈGLE DE COMPTABILISATION « FACTURÉ / RÉGLÉ » (pastilles de la page Ventes)
//
// Le statut d'une ligne de vente ne décide pas D'OÙ vient la donnée
// (la source reste Chiffre d'affaires → Ventes), mais QUAND elle entre
// dans les périmètres :
//
//   planifie   (gris)   → aucune heure, aucun CA
//   realise    (orange) → Temps comptabilisé, CA NON comptabilisé
//   regle      (vert)   → Temps conservé + CA comptabilisé
//   particulier         → cas dérogatoire : Temps et CA comptabilisés
//
// Deux déclencheurs distincts : ne jamais appliquer le même filtre de statut
// aux heures et au CA.
// ---------------------------------------------------------------------------

export type SaleAccountingStatus = "planifie" | "realise" | "regle" | "particulier";

/** Statut effectif d'une ligne (défaut historique : `realise` = facturé). */
export function saleStatusOf(value: string | null | undefined): SaleAccountingStatus {
  switch (value) {
    case "planifie":
      return "planifie";
    case "regle":
      return "regle";
    case "particulier":
      return "particulier";
    default:
      return "realise";
  }
}

/** Le Temps de la ligne entre-t-il dans les heures ? (dès Facturé) */
export function hoursCounted(status: string | null | undefined): boolean {
  return saleStatusOf(status) !== "planifie";
}

/**
 * Périmètre temporel demandé par l'écran. Type structurel volontaire : évite
 * un cycle d'imports avec `pilot-realized.ts`.
 */
export interface SaleAccountingScope {
  period?: "a_date" | "exercice_complet" | (string & {});
}

/** Vrai en lecture « Exercice complet » : toutes les données saisies comptent. */
export function countsAllSaleStatuses(scope?: SaleAccountingScope): boolean {
  return scope?.period === "exercice_complet";
}

/**
 * Le CA HT de la ligne entre-t-il dans le CA ?
 *  - `a_date` (défaut) : uniquement à partir de 🟢 Réglé (+ particulier) ;
 *  - `exercice_complet` : TOUS les statuts saisis (planifié, facturé, réglé,
 *    particulier), car la lecture porte sur l'intégralité de l'exercice.
 * Fonction unique faisant autorité pour tout Pilot Pro.
 */
export function revenueCounted(
  status: string | null | undefined,
  scope?: SaleAccountingScope,
): boolean {
  if (countsAllSaleStatuses(scope)) return true;
  const s = saleStatusOf(status);
  return s === "regle" || s === "particulier";
}

export interface RawSaleRow {
  amount_ht?: number | null;
  hours?: number | null;
  sale_status?: string | null;
}

/**
 * Applique la règle de comptabilisation à une ligne brute :
 * renvoie le CA et le Temps réellement comptabilisables.
 */
export function accountedSale<T extends RawSaleRow>(
  row: T,
  scope?: SaleAccountingScope,
): T & { amount_ht: number; hours: number | null } {
  const ht = Number(row.amount_ht) || 0;
  const h = row.hours == null ? null : Number(row.hours);
  return {
    ...row,
    amount_ht: revenueCounted(row.sale_status, scope) ? ht : 0,
    hours: hoursCounted(row.sale_status) ? h : null,
  };
}