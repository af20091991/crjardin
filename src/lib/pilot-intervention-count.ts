// ---------------------------------------------------------------------------
// NOMBRE D'INTERVENTIONS — RÈGLE UNIQUE ET ABSOLUE
//
// Source unique : page Chiffre d'affaires → section VENTES (pilot_ca_entries,
// kind = 'vente').
//   • 1 ligne de Vente = 1 intervention ;
//   • une ligne à 0 h reste une intervention ;
//   • aucune ligne n'est comptée deux fois (dédoublonnage par identifiant) ;
//   • les CR Chantier, les missions SST et les interventions déclarées dans
//     d'autres modules ne servent JAMAIS à ce comptage.
//
// Toute vignette / carte / module affichant un nombre d'interventions passe par
// ce module : il n'existe pas d'autre méthode de comptabilisation.
// ---------------------------------------------------------------------------

export interface SaleLineRef {
  id?: string | null;
  /** 'vente' | 'charge' | 'remuneration'… (absent = ligne de vente déjà filtrée). */
  kind?: string | null;
  /** Date ISO de la ligne de vente (source principale). */
  entry_date?: string | null;
  /** Repères année / mois quand la date précise n'existe pas. */
  year?: number | null;
  month?: number | null;
  /** Pastille de la ligne de vente ('planifie' | 'realise' | 'regle' | …). */
  sale_status?: string | null;
  /** Temps interne de la ligne (colonne Vente → Temps). */
  hours?: number | null;
}


/** true = la ligne est une ligne de VENTE, donc une intervention. */
export function isSaleLine(row: SaleLineRef): boolean {
  return row.kind == null || row.kind === "vente";
}

function yearMonthOf(row: SaleLineRef): { year: number | null; month: number | null } {
  if (row.entry_date) {
    const d = new Date(row.entry_date);
    if (Number.isFinite(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: row.year ?? null, month: row.month ?? null };
}

export interface InterventionCountFilter {
  /** Exercice concerné (janvier → décembre de cette année). */
  year?: number;
  /** Mois 1-12 (facultatif). */
  month?: number;
}

/**
 * Nombre d'interventions = nombre de lignes de Vente du périmètre.
 * Le périmètre temporel des lignes reçues (À date / Exercice complet) reste
 * celui de l'appelant : ce module ne filtre que l'exercice et le mois demandés.
 */
export function countSaleInterventions(
  rows: SaleLineRef[],
  filter: InterventionCountFilter = {},
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (!isSaleLine(row)) continue;
    const { year, month } = yearMonthOf(row);
    if (filter.year != null && year !== filter.year) continue;
    if (filter.month != null && month !== filter.month) continue;
    if (row.id) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    count += 1;
  }
  return count;
}

/** Comptage par prédicat de date (comparatifs N vs N-1 à date équivalente). */
export function countSaleInterventionsWhere(
  rows: SaleLineRef[],
  keep: (date: Date) => boolean,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (!isSaleLine(row)) continue;
    const iso = row.entry_date ?? (row.year && row.month ? `${row.year}-${String(row.month).padStart(2, "0")}-01` : null);
    if (!iso) continue;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()) || !keep(d)) continue;
    if (row.id) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// COHÉRENCE CA / INTERVENTIONS / HEURES
//
// Une carte qui affiche un CA comptabilisé doit afficher le nombre
// d'interventions du MÊME périmètre : mêmes lignes, même statut, même période.
// Une ligne encore 🔵 Planifié ne produit ni CA ni heures : elle n'est donc pas
// comptée comme intervention réalisée.
// ---------------------------------------------------------------------------

/** true = ligne de vente comptabilisée (dès 🟠 Facturé), donc réalisée. */
export function isBilledSaleLine(row: SaleLineRef): boolean {
  return isSaleLine(row) && hoursCounted(row.sale_status);
}

export interface SaleInterventionScope {
  /** Interventions réalisées = lignes de vente comptabilisées du périmètre. */
  interventions: number;
  /** Heures Vente → Temps de ces mêmes lignes (source unique). */
  hours: number;
  /** Lignes du périmètre dont le Temps est renseigné (> 0 h). */
  interventionsWithHours: number;
}

/**
 * Périmètre unique et cohérent : mêmes lignes pour le comptage et les heures.
 * `keep` reçoit la date comptable de la ligne (bornes déjà appliquées par
 * l'appelant : exercice, mois, « à date »).
 */
export function saleInterventionScopeWhere(
  rows: SaleLineRef[],
  keep: (date: Date) => boolean,
): SaleInterventionScope {
  const seen = new Set<string>();
  const scope: SaleInterventionScope = { interventions: 0, hours: 0, interventionsWithHours: 0 };
  for (const row of rows) {
    if (!isBilledSaleLine(row)) continue;
    const iso =
      row.entry_date ??
      (row.year && row.month ? `${row.year}-${String(row.month).padStart(2, "0")}-01` : null);
    if (!iso) continue;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()) || !keep(d)) continue;
    if (row.id) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    scope.interventions += 1;
    const h = Number(row.hours) || 0;
    scope.hours += h;
    if (h > 0) scope.interventionsWithHours += 1;
  }
  return scope;
}

