// ---------------------------------------------------------------------------
// TAUX HORAIRE — GESTION INCLUSE / EXCLUE (règle unique)
//
//   Gestion exclue  : Taux horaire = CA / heures d'intervention
//   Gestion incluse : Taux horaire = CA / (heures d'intervention + heures de gestion)
//
// Le CA n'est JAMAIS modifié par ce module : seul le dénominateur change.
// Les heures de gestion proviennent exclusivement de
// « Analyse temps & rentabilité → Suivi mensuel → Temps gestion »
// (table pilot_hours, colonne temps_gestion). AUCUN repli : en l'absence de
// saisie, le temps de gestion vaut 0 h. Ni les paramètres TJM, ni une valeur
// par défaut, ni une estimation ne peuvent le compléter.
// ---------------------------------------------------------------------------

export interface GestionHoursRow {
  month: number;
  temps_gestion: number | null;
}

/** Heures de gestion d'un mois (1-12) : saisie du suivi mensuel, sinon 0 h. */
export function gestionHoursForMonth(rows: GestionHoursRow[], month: number): number {
  const row = rows.find((r) => r.month === month);
  const saisie = row?.temps_gestion;
  if (saisie == null) return 0;
  const value = Number(saisie);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Heures de gestion cumulées de l'exercice.
 * `monthLimit` borne le cumul aux mois du périmètre (1-12) : en lecture « À
 * date » on s'arrête au mois en cours, en « Exercice complet » aux 12 mois.
 */
export function gestionHoursForYear(rows: GestionHoursRow[], monthLimit = 12): number {
  const limit = Math.max(0, Math.min(12, Math.round(monthLimit)));
  let total = 0;
  for (let m = 1; m <= limit; m += 1) total += gestionHoursForMonth(rows, m);
  return total;
}

/**
 * Taux horaire selon le mode choisi. Retourne `null` quand le dénominateur est
 * nul : aucune valeur n'est inventée.
 */
export function rateWithGestion(
  ca: number,
  interventionHours: number,
  gestionHours: number,
  includeGestion: boolean,
): number | null {
  const denom = includeGestion ? interventionHours + gestionHours : interventionHours;
  if (!(denom > 0) || !(ca > 0)) return null;
  const value = ca / denom;
  return Number.isFinite(value) ? value : null;
}

export const GESTION_MODE_HELP = {
  incluse:
    "Taux horaire calculé sur les heures d'intervention + les heures de gestion hors terrain (Analyse temps & rentabilité → Suivi mensuel → Temps gestion).",
  exclue: "Taux horaire calculé sur les seules heures d'intervention (Vente → Temps).",
} as const;
