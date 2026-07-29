// Rapport de doublons potentiels de sous-traitance (ex. lignes 2023 recopiées
// en 2024 lors des imports Excel). SIGNALEMENT UNIQUEMENT : aucune ligne n'est
// supprimée ni modifiée. La décision reste humaine.
import type { SstChargeLine } from "@/lib/sst-charges";

export interface SstDuplicateGroup {
  key: string;
  designation: string;
  amount: number;
  month: number;
  years: number[];
  occurrences: { id: string; year: number; month: number }[];
  /** Montant potentiellement compté en double (toutes occurrences sauf une). */
  suspectedAmount: number;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Groupe les lignes ayant le même libellé, le même mois et le même montant sur
 * des années différentes : signature typique d'une recopie d'exercice.
 */
export function sstDuplicateReport(lines: SstChargeLine[]): SstDuplicateGroup[] {
  const map = new Map<string, SstChargeLine[]>();
  for (const l of lines) {
    const key = `${norm(l.designation)}|${l.month}|${l.amount.toFixed(2)}`;
    map.set(key, [...(map.get(key) ?? []), l]);
  }
  const out: SstDuplicateGroup[] = [];
  for (const [key, group] of map) {
    const years = [...new Set(group.map((g) => g.year))].sort((a, b) => a - b);
    if (group.length < 2 || years.length < 2) continue;
    out.push({
      key,
      designation: group[0].designation,
      amount: group[0].amount,
      month: group[0].month,
      years,
      occurrences: group.map((g) => ({ id: g.id, year: g.year, month: g.month })),
      suspectedAmount: group[0].amount * (group.length - 1),
    });
  }
  return out.sort((a, b) => b.suspectedAmount - a.suspectedAmount);
}

export function sstDuplicateTotal(groups: SstDuplicateGroup[]): number {
  return groups.reduce((s, g) => s + g.suspectedAmount, 0);
}
