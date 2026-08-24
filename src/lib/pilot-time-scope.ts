// ---------------------------------------------------------------------------
// RÈGLE MÉTIER CENTRALE ET UNIQUE — DISPONIBILITÉ DU TEMPS
//
// Avant le 01/01/2026, Pilot Pro NE DISPOSE PAS de valeur Temps sur les
// prestations : c'est une donnée historique connue, jamais une donnée
// manquante. Aucune page, aucun moteur, aucune file d'attente ne doit
// réclamer, rechercher, restaurer ou signaler un Temps pour ces exercices.
//
// À partir de 2026, le Temps existe et l'absence peut être contrôlée
// normalement (règles inchangées : voir pilot-sale-time.ts).
//
// Ce module NE calcule aucun montant, NE modifie aucune donnée et NE supprime
// jamais une ligne financière : il qualifie seulement l'attente d'un Temps.
// ---------------------------------------------------------------------------

/** Premier exercice pour lequel un Temps peut exister dans Pilot Pro. */
export const TIME_TRACKING_START_YEAR = 2026;

/** Qualification de l'attente d'un Temps sur un exercice. */
export type TimeRequirement = "non_applicable" | "attendu";

export const TIME_REQUIREMENT_LABEL: Record<TimeRequirement, string> = {
  non_applicable: `Temps non disponible avant ${TIME_TRACKING_START_YEAR} — donnée historique, aucun contrôle requis`,
  attendu: "Temps attendu sur cet exercice",
};

/** Phrase unique affichée pour l'historique antérieur à 2026. */
export const TIME_HISTORIC_NOTE = TIME_REQUIREMENT_LABEL.non_applicable;

/** Le Temps est-il suivi sur cet exercice ? (année inconnue = suivie) */
export function isTimeTrackedYear(year: number | null | undefined): boolean {
  if (typeof year !== "number" || !Number.isFinite(year)) return true;
  return year >= TIME_TRACKING_START_YEAR;
}

/** Qualification explicite, à utiliser dans les libellés et les rapports. */
export function timeRequirementForYear(year: number | null | undefined): TimeRequirement {
  return isTimeTrackedYear(year) ? "attendu" : "non_applicable";
}

/**
 * Une demande de renseignement du Temps est-elle applicable à cette ligne ?
 * `false` pour tout exercice antérieur à 2026 : ce n'est pas une anomalie.
 */
export function timeRequestApplies(row: { year?: number | null }): boolean {
  return isTimeTrackedYear(row.year);
}

/**
 * Filtre générique : ne conserve que les lignes pour lesquelles une demande de
 * Temps a un sens. Les lignes écartées ne sont ni supprimées ni modifiées :
 * elles quittent seulement les files de validation et les alertes.
 */
export function keepTimeRequests<T extends { year?: number | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => timeRequestApplies(r));
}
