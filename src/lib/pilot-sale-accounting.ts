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

/** Le CA HT de la ligne entre-t-il dans le CA ? (uniquement à partir de Réglé) */
export function revenueCounted(status: string | null | undefined): boolean {
  const s = saleStatusOf(status);
  return s === "regle" || s === "particulier";
}