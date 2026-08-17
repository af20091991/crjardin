// PÉRIMÈTRE DE CERTIFICATION — HISTORIQUE ANTÉRIEUR À 2026.
//
// L'entreprise ne possède aucune donnée avant le 01/01/2026 et ne pourra
// jamais les reconstituer. Ce module ne fait que QUALIFIER cette absence :
// il ne calcule aucun montant, ne fabrique aucune donnée, ne modifie aucune
// source. Une absence hors périmètre n'est ni une erreur, ni une anomalie,
// ni un blocage, et elle ne pèse jamais sur la couverture 2026 et suivantes.

/** Premier exercice réellement documenté et certifiable. */
export const CERTIFICATION_START_YEAR = 2026;

/** Qualification explicite d'une période au regard du périmètre. */
export type HistoryScope = "hors_perimetre" | "mixte" | "certifiable";

export const HISTORY_SCOPE_LABEL: Record<HistoryScope, string> = {
  hors_perimetre: "Hors périmètre de certification",
  mixte: "Périmètre mixte (historique + exercices certifiables)",
  certifiable: "Dans le périmètre de certification",
};

/** Message unique affiché pour toute période antérieure à 2026. */
export const HISTORY_OUT_OF_SCOPE_MESSAGE =
  "Données historiques antérieures à 2026 non disponibles — hors périmètre de certification";

/** Statut explicite porté par un contrôle qui n'a pas lieu d'être. */
export const NOT_REQUIRED_STATE = "hors_perimetre" as const;

export function isOutOfCertificationScope(year: number | null | undefined): boolean {
  return typeof year === "number" && Number.isFinite(year) && year < CERTIFICATION_START_YEAR;
}

/** Qualification d'un ensemble d'exercices (vide = certifiable par défaut). */
export function historyScopeForYears(years: readonly number[]): HistoryScope {
  if (years.length === 0) return "certifiable";
  const out = years.filter((y) => isOutOfCertificationScope(y)).length;
  if (out === 0) return "certifiable";
  if (out === years.length) return "hors_perimetre";
  return "mixte";
}

/** Qualification d'un exercice unique. */
export function historyScopeForYear(year: number | null | undefined): HistoryScope {
  return isOutOfCertificationScope(year) ? "hors_perimetre" : "certifiable";
}

/**
 * Sépare des lignes annuelles : l'historique non requis d'un côté, le
 * périmètre réellement certifiable de l'autre. Aucune ligne n'est supprimée.
 */
export function splitByCertificationScope<T extends { year: number }>(
  rows: readonly T[],
): { historical: T[]; certifiable: T[] } {
  const historical: T[] = [];
  const certifiable: T[] = [];
  for (const r of rows) (isOutOfCertificationScope(r.year) ? historical : certifiable).push(r);
  return { historical, certifiable };
}

/** Phrase de lecture d'une couverture selon son périmètre. */
export function coverageScopeNote(scope: HistoryScope): string {
  if (scope === "hors_perimetre") return HISTORY_OUT_OF_SCOPE_MESSAGE;
  if (scope === "mixte")
    return `Couverture affichée sur les exercices ${CERTIFICATION_START_YEAR} et suivants — ${HISTORY_OUT_OF_SCOPE_MESSAGE.toLowerCase()}`;
  return HISTORY_SCOPE_LABEL.certifiable;
}
