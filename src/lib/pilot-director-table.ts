// Tableau financier mensuel « suivi Excel » du dirigeant.
// Données strictement réelles : uniquement les mois déjà écoulés (règle
// pilot-realized), aucune projection, aucun objectif estimé.
//
// Source unique : pilot_ca_entries (via listCaEntries), déjà utilisée par
// les moteurs pilot-ca.ts (monthTotals / categoryTotals). Aucun recalcul
// métier n'est fait ici : on assemble simplement les agrégats existants
// mois par mois pour l'exercice en cours et l'exercice précédent.

import { MONTH_NAMES, categoryTotals, monthTotals, type CaEntry } from "@/lib/pilot-ca";
import { isRealizedMonth } from "@/lib/pilot-realized";

export interface DirectorMonthRow {
  month: number;
  monthLabel: string;
  chargesHt: number;
  caHt: number;
  caTtc: number;
  /** CA HT relevant de la catégorie SAP (marqueur existant dans pilot_ca_entries.category). */
  sapHt: number | null;
  beneficeNet: number;
  caHtCumule: number;
  caHtMoisN1: number | null;
  caHtCumuleN1: number | null;
  evolutionPct: number | null;
  remarques: string;
}

export interface DirectorTableResult {
  year: number;
  rows: DirectorMonthRow[];
  hasSapMarker: boolean;
  totals: {
    chargesHt: number;
    caHt: number;
    caTtc: number;
    sapHt: number | null;
    beneficeNet: number;
  };
  synthese: {
    caHtCumule: number;
    chargesHtCumulees: number;
    beneficeNetCumule: number;
    caHtCumuleN1: number | null;
    evolutionPct: number | null;
  };
}

function monthNotes(entries: CaEntry[], month: number): string {
  const notes = entries
    .filter((e) => e.month === month && e.kind === "vente" && e.note && e.note.trim().length > 0)
    .map((e) => e.note!.trim());
  return [...new Set(notes)].join(" · ");
}

/**
 * Construit le tableau financier mensuel de l'exercice `year`, en s'appuyant
 * sur les entrées réelles de `year` et `year - 1` (pour les comparaisons N-1).
 * Seuls les mois déjà réalisés (règle pilot-realized) sont retournés.
 */
export function buildDirectorTable(
  entriesYear: CaEntry[],
  entriesPrevYear: CaEntry[],
  year: number,
  now = new Date(),
): DirectorTableResult {
  const hasSapMarker = entriesYear.some((e) => e.category != null);
  const lastMonth = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => isRealizedMonth(year, m, now));

  let caHtCumule = 0;
  let caHtCumuleN1 = 0;
  const rows: DirectorMonthRow[] = lastMonth.map((month) => {
    const t = monthTotals(entriesYear, month);
    const tPrev = monthTotals(entriesPrevYear, month);
    const sapCat = categoryTotals(entriesYear, month).find((c) => c.category === "SAP");
    caHtCumule += t.ventesHt;
    // Cumul N-1 « à date équivalente » : uniquement si le mois N-1 est bien renseigné.
    const hasPrevMonth = entriesPrevYear.some((e) => e.month === month);
    if (hasPrevMonth) caHtCumuleN1 += tPrev.ventesHt;
    const evolutionPct = tPrev.ventesHt > 0 ? ((t.ventesHt - tPrev.ventesHt) / tPrev.ventesHt) * 100 : null;
    return {
      month,
      monthLabel: MONTH_NAMES[month - 1],
      chargesHt: t.chargesHt,
      caHt: t.ventesHt,
      caTtc: t.ventesTtc,
      sapHt: hasSapMarker ? sapCat?.ht ?? 0 : null,
      beneficeNet: t.ventesHt - t.chargesHt,
      caHtCumule,
      caHtMoisN1: hasPrevMonth ? tPrev.ventesHt : null,
      caHtCumuleN1: hasPrevMonth ? caHtCumuleN1 : null,
      evolutionPct,
      remarques: monthNotes(entriesYear, month),
    };
  });

  const totals = {
    chargesHt: rows.reduce((s, r) => s + r.chargesHt, 0),
    caHt: rows.reduce((s, r) => s + r.caHt, 0),
    caTtc: rows.reduce((s, r) => s + r.caTtc, 0),
    sapHt: hasSapMarker ? rows.reduce((s, r) => s + (r.sapHt ?? 0), 0) : null,
    beneficeNet: rows.reduce((s, r) => s + r.beneficeNet, 0),
  };

  const lastRow = rows[rows.length - 1] ?? null;
  const synthese = {
    caHtCumule: totals.caHt,
    chargesHtCumulees: totals.chargesHt,
    beneficeNetCumule: totals.beneficeNet,
    caHtCumuleN1: lastRow?.caHtCumuleN1 ?? null,
    evolutionPct:
      lastRow?.caHtCumuleN1 && lastRow.caHtCumuleN1 > 0
        ? ((totals.caHt - lastRow.caHtCumuleN1) / lastRow.caHtCumuleN1) * 100
        : null,
  };

  return { year, rows, hasSapMarker, totals, synthese };
}
