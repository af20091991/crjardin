// Aides pures de présentation du dashboard (Vue année / Vue mois).
// Aucune règle métier : regroupements par statut / catégorie et variations,
// à partir des lignes de Chiffre d'affaires déjà chargées. Le CA « compté »
// reste calculé par pilot-ca.ts ; ici on montre aussi le planifié, à part.

import type { CaEntry } from "@/lib/pilot-ca";

export type StatusRow = {
  label: string;
  Réglé: number;
  Réalisé: number;
  Planifié: number;
  Particulier: number;
};

/** Variation en % entre deux valeurs ; null si la base de comparaison est nulle. */
export function variationPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** CA HT des lignes de vente par mois et par statut (réglé / réalisé / planifié). */
export function salesByStatus(
  entries: CaEntry[],
  months: Array<{ month: number; label: string }>,
): StatusRow[] {
  return months.map(({ month, label }) => {
    const row: StatusRow = { label, Réglé: 0, Réalisé: 0, Planifié: 0, Particulier: 0 };
    for (const entry of entries) {
      if (entry.kind !== "vente" || entry.month !== month) continue;
      const amount = Number(entry.amount_ht) || 0;
      if (entry.sale_status === "regle") row.Réglé += amount;
      else if (entry.sale_status === "realise") row.Réalisé += amount;
      else if (entry.sale_status === "planifie") row.Planifié += amount;
      else if (entry.sale_status === "particulier") row.Particulier += amount;
    }
    return {
      label,
      Réglé: Math.round(row.Réglé),
      Réalisé: Math.round(row.Réalisé),
      Planifié: Math.round(row.Planifié),
      Particulier: Math.round(row.Particulier),
    };
  });
}

/** CA HT des lignes de vente par catégorie (tous statuts), du plus gros au plus petit. */
export function salesByCategory(
  entries: CaEntry[],
  month?: number,
): Array<{ name: string; value: number }> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "vente") continue;
    if (month != null && entry.month !== month) continue;
    const name = entry.category ?? "Non classé";
    map.set(name, (map.get(name) ?? 0) + (Number(entry.amount_ht) || 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}
