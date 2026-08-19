// ---------------------------------------------------------------------------
// Lecture de la liste clients : présentation uniquement.
// Aucun calcul métier, aucun statut modifié. Ces fonctions décident seulement
// CE QUI EST AFFICHÉ (colonne favoris / autres, visibilité des clients perdus).
// ---------------------------------------------------------------------------

export type ClientListStatusFilter =
  | "all"
  | "actif"
  | "a_relancer"
  | "dormant"
  | "perdu"
  | "cr_a_qualifier";

/**
 * Les clients perdus sont masqués par défaut. Ils redeviennent visibles soit
 * volontairement (case « Afficher les clients perdus »), soit parce que le
 * filtre « Clients perdus » est explicitement demandé.
 */
export function lostVisible(filter: ClientListStatusFilter, showLost: boolean): boolean {
  return filter === "perdu" || showLost;
}

/** Le client reste-t-il affiché compte tenu de son cycle de vie ? */
export function keepForLifecycle(
  lifecycle: string | null | undefined,
  filter: ClientListStatusFilter,
  showLost: boolean,
): boolean {
  if ((lifecycle ?? "actif") !== "perdu") return true;
  return lostVisible(filter, showLost);
}

/** Répartition stricte : un favori n'apparaît jamais dans « les autres ». */
export function splitFavorites<T>(
  rows: T[],
  isFavorite: (row: T) => boolean,
): { favorites: T[]; others: T[] } {
  const favorites: T[] = [];
  const others: T[] = [];
  for (const r of rows) (isFavorite(r) ? favorites : others).push(r);
  return { favorites, others };
}
