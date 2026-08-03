// Comparatifs temporels Pilot Pro (V2.2).
//
// Deux seules lectures autorisées pour le pilotage quotidien :
//  · mois en cours N  vs  même mois N-1
//  · cumul au jour J  vs  même date N-1
// La comparaison « fin d'exercice précédent » est volontairement absente :
// comparer un exercice incomplet à un exercice complet n'a aucun sens.
//
// Aucune nouvelle source : uniquement les lignes CA déjà enregistrées.

export interface DatedAmount {
  entry_date: string;
  amount_ht: number;
}

export interface Comparison {
  available: boolean;
  current: number;
  previous: number;
  deltaEuro: number;
  /** null si la période de référence est vide (division impossible). */
  deltaPct: number | null;
  /** Phrase prête à afficher, en langage naturel. */
  comment: string;
  /** Libellé des deux périodes comparées. */
  label: string;
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function sum(rows: DatedAmount[], keep: (d: Date) => boolean): number {
  let total = 0;
  for (const r of rows) {
    const d = new Date(r.entry_date);
    if (!Number.isFinite(d.getTime())) continue;
    if (keep(d)) total += Number(r.amount_ht) || 0;
  }
  return total;
}

function build(current: number, previous: number, label: string, periodName: string): Comparison {
  const deltaEuro = current - previous;
  const deltaPct = previous > 0 ? (deltaEuro / previous) * 100 : null;
  let comment: string;
  if (previous <= 0 && current <= 0) {
    comment = `Aucun chiffre d'affaires facturé sur ${periodName}, ni sur la période de référence.`;
  } else if (previous <= 0) {
    comment = `Aucune référence l'an dernier sur ${periodName} : la comparaison n'est pas calculable, seul le montant de cette année est fiable.`;
  } else if (deltaPct != null && deltaPct >= 5) {
    comment = `${periodName} progresse de ${deltaPct.toFixed(0)} % par rapport à l'an dernier : rythme d'activité supérieur.`;
  } else if (deltaPct != null && deltaPct <= -5) {
    comment = `${periodName} recule de ${Math.abs(deltaPct).toFixed(0)} % par rapport à l'an dernier : à surveiller côté commercial.`;
  } else {
    comment = `${periodName} est stable par rapport à l'an dernier (écart inférieur à 5 %).`;
  }
  return {
    available: previous > 0 || current > 0,
    current,
    previous,
    deltaEuro,
    deltaPct,
    comment,
    label,
  };
}

/** CA du mois en cours comparé au même mois de l'exercice précédent. */
export function monthVsSameMonthLastYear(
  rows: DatedAmount[],
  year: number,
  /** Mois 0-11. */
  month: number,
): Comparison {
  const current = sum(rows, (d) => d.getFullYear() === year && d.getMonth() === month);
  const previous = sum(rows, (d) => d.getFullYear() === year - 1 && d.getMonth() === month);
  return build(
    current,
    previous,
    `${MONTHS[month]} ${year} vs ${MONTHS[month]} ${year - 1}`,
    `Le mois de ${MONTHS[month]}`,
  );
}

/** CA cumulé depuis le 1er janvier au jour J, comparé à la même date N-1. */
export function toDateVsSameDateLastYear(rows: DatedAmount[], now: Date = new Date()): Comparison {
  const year = now.getFullYear();
  const dayOfYear = (d: Date) => {
    const start = Date.UTC(d.getFullYear(), 0, 1);
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86_400_000);
  };
  const limit = dayOfYear(now);
  const current = sum(rows, (d) => d.getFullYear() === year && dayOfYear(d) <= limit);
  const previous = sum(rows, (d) => d.getFullYear() === year - 1 && dayOfYear(d) <= limit);
  const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
  return build(
    current,
    previous,
    `au ${dateLabel} ${year} vs au ${dateLabel} ${year - 1}`,
    `Le cumul au ${dateLabel}`,
  );
}