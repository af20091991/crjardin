// Tableau des 12 mois de l'exercice pour la page Chiffre d'affaires.
//
// AUCUN filtrage n'est réimplémenté ici : les montants viennent de `monthTotals`
// (feuille Ventes/Charges) et l'éligibilité d'une ligne du filtre central
// `keepRealizedYearMonth` de `pilot-realized.ts` (source de vérité unique).
import { monthTotals, MONTH_NAMES, type CaEntry } from "@/lib/pilot-ca";
import {
  isRealizedMonth,
  keepRealizedYearMonth,
  type AsOfOptions,
} from "@/lib/pilot-realized";

/** Nature d'un mois : jamais « réalisé » pour une donnée future. */
export type MonthNature = "realise_a_date" | "saisi_futur" | "aucun";

export const MONTH_NATURE_LABELS: Record<MonthNature, string> = {
  realise_a_date: "Réalisé à date",
  saisi_futur: "Saisi — futur",
  aucun: "Aucun enregistrement",
};

export interface MonthlyCaRow {
  month: number;
  monthLabel: string;
  /** Ventes éligibles du mois (comptabilisation métier inchangée). */
  ventesHt: number;
  /** Charges d'exploitation éligibles du mois (investissements exclus). */
  chargesHt: number;
  /** Résultat des saisies = ventes éligibles − charges éligibles. */
  resultat: number;
  nature: MonthNature;
  /** Nombre de lignes éligibles retenues (preuve de non-invention). */
  rowCount: number;
}

/** Libellé du résultat selon la nature (jamais un réalisé pour du futur). */
export function monthResultLabel(nature: MonthNature): string {
  if (nature === "saisi_futur") return "Résultat estimé à partir des saisies existantes";
  if (nature === "aucun") return "Aucun enregistrement";
  return "Résultat réalisé à date";
}

/**
 * Construit les 12 lignes de l'exercice. Un mois sans aucune ligne éligible
 * reste à zéro et porte la nature « Aucun enregistrement » : aucune moyenne,
 * aucune extrapolation, aucune projection.
 */
export function monthlyCaRows(
  entries: CaEntry[],
  year: number,
  options?: AsOfOptions,
): MonthlyCaRow[] {
  const now = options?.now ?? new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const t = monthTotals(entries, month, options);
    const kept = entries.filter(
      (e) =>
        Number(e.month) === month &&
        (e.kind === "vente" || (e.kind === "charge" && !e.is_investment)) &&
        keepRealizedYearMonth(
          { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
          options,
        ),
    );
    const nature: MonthNature =
      kept.length === 0 ? "aucun" : isRealizedMonth(year, month, now) ? "realise_a_date" : "saisi_futur";
    return {
      month,
      monthLabel: MONTH_NAMES[month - 1],
      ventesHt: kept.length === 0 ? 0 : t.ventesHt,
      chargesHt: kept.length === 0 ? 0 : t.chargesHt,
      resultat: kept.length === 0 ? 0 : t.ventesHt - t.chargesHt,
      nature,
      rowCount: kept.length,
    };
  });
}

export interface MonthlyCaTotals {
  ventesHt: number;
  chargesHt: number;
  resultat: number;
  rowCount: number;
  monthsWithData: number;
  monthsFuture: number;
}

/** Total annuel = somme EXACTE des 12 lignes affichées (jamais recalculé à part). */
export function monthlyCaTotals(rows: MonthlyCaRow[]): MonthlyCaTotals {
  return {
    ventesHt: rows.reduce((s, r) => s + r.ventesHt, 0),
    chargesHt: rows.reduce((s, r) => s + r.chargesHt, 0),
    resultat: rows.reduce((s, r) => s + r.resultat, 0),
    rowCount: rows.reduce((s, r) => s + r.rowCount, 0),
    monthsWithData: rows.filter((r) => r.nature !== "aucun").length,
    monthsFuture: rows.filter((r) => r.nature === "saisi_futur").length,
  };
}
