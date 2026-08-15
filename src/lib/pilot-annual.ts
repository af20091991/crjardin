import type { PilotEntry } from "@/lib/pilot";
import { operatingCharges, type ChargeRow } from "@/lib/pilot-charges";
import { chargeRowsForMode, entriesForMode, type AsOfOptions } from "@/lib/pilot-realized";

/**
 * Synthèse annuelle multi-exercices : une ligne par année réellement présente
 * dans les données PP. Aucune année n'est inventée, aucune valeur extrapolée.
 */
export interface AnnualRow {
  year: number;
  caHt: number;
  charges: number;
  /** Bénéfice brut = CA HT − charges enregistrées sur l'exercice. */
  beneficeBrut: number;
  margePct: number | null;
  heuresVendues: number;
  tauxHoraireVendu: number | null;
  nbLignes: number;
  /** Investissements qualifiés sur l'exercice (hors charges d'exploitation). */
  investissements: number;
  /** Bénéfice brut − investissements de l'exercice. */
  resultatApresInvestissements: number;
  /**
   * Exercice exploitable pour une décision : des charges ont bien été
   * enregistrées. Un exercice sans aucune charge (ex. reprise partielle d'un
   * historique) afficherait sinon 100 % de marge.
   */
  chargesComplete: boolean;
}

export function annualSummary(
  entries: PilotEntry[],
  allChargeRows: ChargeRow[],
  options?: AsOfOptions,
): AnnualRow[] {
  // Filtre « à date » unique : aucune ligne ni aucun mois futur n'entre dans le
  // réalisé annuel (la date de référence est injectable pour les tests).
  const scopedEntries = entriesForMode(
    entries,
    options?.mode ?? "reel",
    options?.now,
    options?.period,
  );
  const scopedCharges = operatingCharges(
    chargeRowsForMode(allChargeRows, options?.mode ?? "reel", options?.now, options?.period),
  );
  const chargeRows = scopedCharges.filter((c) => !c.is_investment);
  const years = new Set<number>();
  const ca = new Map<number, number>();
  const hours = new Map<number, number>();
  const caRated = new Map<number, number>();
  const lines = new Map<number, number>();
  for (const e of scopedEntries) {
    const y = new Date(e.entry_date).getFullYear();
    if (!Number.isFinite(y)) continue;
    years.add(y);
    ca.set(y, (ca.get(y) ?? 0) + (Number(e.amount_ht) || 0));
    // Taux horaire : seules les lignes de vente porteuses de temps comptent.
    if ((Number(e.hours) || 0) > 0) {
      hours.set(y, (hours.get(y) ?? 0) + (Number(e.hours) || 0));
      caRated.set(y, (caRated.get(y) ?? 0) + (Number(e.amount_ht) || 0));
    }
    lines.set(y, (lines.get(y) ?? 0) + 1);
  }
  const charges = new Map<number, number>();
  for (const c of chargeRows) {
    years.add(c.year);
    charges.set(c.year, (charges.get(c.year) ?? 0) + c.amount_ht);
  }
  const invest = new Map<number, number>();
  for (const c of scopedCharges) {
    if (!c.is_investment) continue;
    years.add(c.year);
    invest.set(c.year, (invest.get(c.year) ?? 0) + c.amount_ht);
  }

  return [...years]
    .sort((a, b) => b - a)
    .map((year) => {
      const caHt = ca.get(year) ?? 0;
      const ch = charges.get(year) ?? 0;
      const h = hours.get(year) ?? 0;
      const caR = caRated.get(year) ?? 0;
      const benefice = caHt - ch;
      const inv = invest.get(year) ?? 0;
      const chargesComplete = ch > 0;
      return {
        year,
        caHt,
        charges: ch,
        beneficeBrut: benefice,
        // Sans charge enregistrée, la marge n'est pas calculable : ne jamais
        // afficher 100 % sur un exercice incomplet.
        margePct: caHt > 0 && chargesComplete ? (benefice / caHt) * 100 : null,
        heuresVendues: h,
        tauxHoraireVendu: h > 0 && caR > 0 ? caR / h : null,
        nbLignes: lines.get(year) ?? 0,
        investissements: inv,
        resultatApresInvestissements: benefice - inv,
        chargesComplete,
      };
    });
}

/** Exercices exploitables pour une comparaison ou un CAGR (charges présentes). */
export function completeYears(rows: AnnualRow[]): AnnualRow[] {
  return rows.filter((r) => r.chargesComplete);
}