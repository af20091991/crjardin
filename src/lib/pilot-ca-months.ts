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
  /**
   * Charges fixes reportées en « Année complète » : la charge fixe de
   * référence (le mois où elle est renseignée) est propagée aux mois futurs
   * SANS ligne dédiée, à titre d'ESTIMATION. Aucune écriture, aucun impact
   * sur le réalisé « à date ».
   */
  chargesFixesReportees?: number;
  /** Investissements qualifiés du mois, suivis à part (jamais en charges). */
  investissements: number;
}

/** Libellé du résultat selon la nature (jamais un réalisé pour du futur). */
export function monthResultLabel(nature: MonthNature): string {
  if (nature === "saisi_futur") return "Résultat estimé à partir des saisies existantes";
  if (nature === "aucun") return "Aucun enregistrement";
  return "Résultat réalisé à date";
}

/**
 * Montant mensuel des charges fixes retenu pour un mois donné : le montant de
 * la ligne « charges fixes » du mois s'il existe, sinon le montant de la ligne
 * de référence la plus récente disponible avant ce mois.
 */
function referenceFixedAmount(entries: CaEntry[], year: number, month: number): number | null {
  const fixed = entries.filter(
    (e) =>
      e.kind === "charge" &&
      e.is_fixed &&
      Number(e.year) === year &&
      Number(e.month) <= month &&
      e.amount_ht > 0,
  );
  if (fixed.length === 0) return null;
  fixed.sort((a, b) => Number(b.month) - Number(a.month));
  return fixed[0].amount_ht || 0;
}

/**
 * Construit les 12 lignes de l'exercice. Un mois sans aucune ligne éligible
 * reste à zéro et porte la nature « Aucun enregistrement » : aucune moyenne,
 * aucune extrapolation, aucune projection.
 *
 * `propagateFixedReference` : en lecture « exercice complet », chaque mois
 * futur sans ligne « charges fixes » reçoit, à titre d'ESTIMATION, la charge
 * fixe de référence (dernier montant renseigné). Jamais appliqué « à date ».
 */
export function monthlyCaRows(
  entries: CaEntry[],
  year: number,
  options?: AsOfOptions,
  propagateFixedReference = false,
): MonthlyCaRow[] {
  const now = options?.now ?? new Date();
  const isFullYear = options?.mode === "projection" || options?.period === "exercice_complet";
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
    const investments = entries
      .filter(
        (e) =>
          e.kind === "charge" &&
          e.is_investment &&
          Number(e.month) === month &&
          keepRealizedYearMonth(
            { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
            options,
          ),
      )
      .reduce((s, e) => s + (e.amount_ht || 0), 0);
    const hasOwnFixed = kept.some((e) => e.is_fixed);
    const propagated =
      propagateFixedReference && isFullYear && !hasOwnFixed
        ? (referenceFixedAmount(entries, year, month) ?? 0)
        : 0;
    const chargesHt =
      kept.length === 0 && propagated === 0 ? 0 : t.chargesHt + propagated;
    const nature: MonthNature =
      kept.length === 0 && propagated === 0
        ? "aucun"
        : isRealizedMonth(year, month, now)
          ? "realise_a_date"
          : "saisi_futur";
    return {
      month,
      monthLabel: MONTH_NAMES[month - 1],
      ventesHt: kept.length === 0 ? 0 : t.ventesHt,
      chargesHt,
      resultat: kept.length === 0 && propagated === 0 ? 0 : t.ventesHt - chargesHt,
      nature,
      rowCount: kept.length,
      ...(propagated > 0 ? { chargesFixesReportees: propagated } : {}),
      investissements: kept.length === 0 && investments === 0 ? 0 : investments,
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
  /** Total des investissements qualifiés : compté une seule fois dans l'année. */
  investissements: number;
  /** Total des charges fixes reportées (estimation, exercice complet). */
  chargesFixesReportees: number;
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
    investissements: rows.reduce((s, r) => s + r.investissements, 0),
    chargesFixesReportees: rows.reduce((s, r) => s + (r.chargesFixesReportees ?? 0), 0),
  };
}
