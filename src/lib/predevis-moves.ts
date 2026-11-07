// Pré-devis — déplacement des lignes entre postes (pur).
// Invariant : le total HT de l'ensemble des lignes (affectées + non affectées) ne change jamais.
export type MovableLine = { id: string; poste_id: string | null; ht: number | null };

export function moveLine<T extends MovableLine>(lines: T[], lineId: string, target: string | null): T[] {
  return lines.map((l) => (l.id === lineId ? { ...l, poste_id: target } : l));
}

/** Total HT de toutes les lignes, sans exclusion. Sert à vérifier l'invariant. */
export function totalHtAll(lines: MovableLine[]): number {
  return Math.round(lines.reduce((s, l) => s + (l.ht ?? 0), 0) * 100) / 100;
}

/** Lignes qui ne sont dans aucun poste. */
export function unaffected<T extends MovableLine>(lines: T[]): T[] {
  return lines.filter((l) => l.poste_id == null);
}
