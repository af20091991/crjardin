// Investissements qualifiés du classeur (pilot_ca_entries.is_investment).
//
// RÈGLE : un investissement n'est JAMAIS une charge d'exploitation. Il ne
// pèse donc pas sur le résultat mensuel et n'est compté qu'une seule fois
// dans le total annuel. Aucun filtrage réimplémenté : `keepRealizedYearMonth`
// reste la source unique d'éligibilité temporelle.
import type { CaEntry } from "@/lib/pilot-ca";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";

function eligible(e: CaEntry, options?: AsOfOptions): boolean {
  return keepRealizedYearMonth(
    { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
    options,
  );
}

/** Lignes d'investissement éligibles (optionnellement d'un seul mois). */
export function investmentEntries(
  entries: CaEntry[],
  month?: number,
  options?: AsOfOptions,
): CaEntry[] {
  return entries.filter(
    (e) =>
      e.kind === "charge" &&
      !!e.is_investment &&
      (month == null || Number(e.month) === month) &&
      eligible(e, options),
  );
}

/** Total des investissements : une ligne n'est comptée qu'une seule fois. */
export function investmentsTotal(
  entries: CaEntry[],
  month?: number,
  options?: AsOfOptions,
): number {
  return investmentEntries(entries, month, options).reduce((s, e) => s + (e.amount_ht || 0), 0);
}

/**
 * Résultat après investissements = résultat d'exploitation − investissements
 * de la période. Présenté séparément, jamais mélangé au bénéfice.
 */
export function resultAfterInvestments(operatingResult: number, investments: number): number {
  return Math.round((operatingResult - investments) * 100) / 100;
}
