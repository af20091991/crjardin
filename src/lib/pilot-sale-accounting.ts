// ---------------------------------------------------------------------------
// RÈGLE DE COMPTABILISATION « FACTURÉ / RÉGLÉ » (pastilles de la page Ventes)
//
// La période et le statut sont deux choses différentes :
// - la période dit QUAND regarder les lignes ;
// - le statut dit SI le CA est réellement comptabilisé.
// ---------------------------------------------------------------------------

export type SaleAccountingStatus = "planifie" | "realise" | "regle" | "particulier";

/** Statut effectif d'une ligne (défaut historique : `realise` = facturé). */
export function saleStatusOf(value: string | null | undefined): SaleAccountingStatus {
  switch (value) {
    case "planifie": return "planifie";
    case "regle": return "regle";
    case "particulier": return "particulier";
    default: return "realise";
  }
}

/** Le Temps de la ligne entre-t-il dans les heures ? (dès Facturé) */
export function hoursCounted(status: string | null | undefined): boolean {
  return saleStatusOf(status) !== "planifie";
}

/** Périmètre temporel demandé par l'écran. */
export interface SaleAccountingScope {
  period?: "a_date" | "exercice_complet" | (string & {});
}

/** Conservé pour compatibilité avec les anciens appelants. */
export function countsAllSaleStatuses(_scope?: SaleAccountingScope): boolean {
  return false;
}

/**
 * Le CA HT est comptabilisé uniquement lorsqu'il est réellement réglé.
 * « Exercice complet » signifie « toute la période », pas « inclure les
 * ventes planifiées ou simplement facturées ». Une projection doit rester
 * séparée du réalisé.
 */
export function revenueCounted(
  status: string | null | undefined,
  _scope?: SaleAccountingScope,
): boolean {
  const s = saleStatusOf(status);
  return s === "regle" || s === "particulier";
}

export interface RawSaleRow {
  amount_ht?: number | null;
  hours?: number | null;
  sale_status?: string | null;
}

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
