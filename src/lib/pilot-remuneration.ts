// Rémunération dirigeant : traitée à part, jamais mélangée aux charges
// d'exploitation classiques.
// Règle métier conservée : la rémunération saisie est un NET ; le coût
// entreprise = net + 45 % de cotisations (SOCIAL_CONTRIBUTION_RATE).
import { remunerationBreakdown, SOCIAL_CONTRIBUTION_RATE } from "@/lib/pilot-fixed-charges";
import type { ChargeRow } from "@/lib/pilot-charges";

export { SOCIAL_CONTRIBUTION_RATE, remunerationBreakdown };

const REMU_MARKERS = [
  "remuneration",
  "rémunération",
  "remuneration dirigeant",
  "salaire dirigeant",
  "salaire gerant",
  "salaire gérant",
  "prelevement dirigeant",
  "prélèvement dirigeant",
];

function norm(s: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** true si le libellé (ou la catégorie) désigne une rémunération. */
export function isRemunerationLabel(label: string | null): boolean {
  const l = norm(label);
  if (!l) return false;
  return REMU_MARKERS.some((m) => l.includes(norm(m)));
}

/** Sépare les lignes de rémunération des charges d'exploitation. */
export function splitRemuneration(rows: ChargeRow[]): {
  charges: ChargeRow[];
  remuneration: ChargeRow[];
} {
  const charges: ChargeRow[] = [];
  const remuneration: ChargeRow[] = [];
  for (const r of rows) {
    if (isRemunerationLabel(r.designation) || isRemunerationLabel(r.charge_category)) {
      remuneration.push(r);
    } else {
      charges.push(r);
    }
  }
  return { charges, remuneration };
}

/** Coût entreprise d'une rémunération nette (net + cotisations). */
export function employerCost(net: number): number {
  return remunerationBreakdown(net).total;
}

/** Coût entreprise agrégé par année à partir de montants nets. */
export function remunerationCostByYear(rows: { year: number; amount_ht: number }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    m.set(r.year, (m.get(r.year) ?? 0) + employerCost(r.amount_ht));
  }
  return m;
}
