// Pré-devis — indicateurs financiers par poste (pur).
// Règles validées : marge = PV HT − PAU HT ; taux = marge ÷ PV HT ; prix de vente du poste = somme des TTC ligne.
// Une ligne dont la donnée manque ne bloque pas le calcul : le total porte sur les lignes renseignées,
// et chaque donnée manquante est signalée dans `issues` (à compléter, sans bloquer).
// Un indicateur sans aucune donnée connue reste `null` (jamais 0 inventé).

export type FinanceLine = {
  kind: "fourniture" | "mo";
  ht: number | null;
  ttc: number | null;
  /** Coût HT de la ligne : fourniture = quantité × unité × PAU ; MO = coût saisi. null = inconnu. */
  costHt: number | null;
  zeroCostReason: "remise" | "sav" | null;
};

export type PosteFinance = {
  pvHt: number | null;
  pvTtc: number | null;
  /** Prix de revient du poste : fournitures + main-d'œuvre saisie (lignes renseignées). */
  prixAchatHt: number | null;
  /** Achat HT des seules fournitures (lignes renseignées). */
  achatFournituresHt: number | null;
  margeHt: number | null;
  tauxMarge: number | null; // en %
  partMo: number | null; // en % du PV HT
  partFournitures: number | null; // en % du PV HT
  /** Coût de sous-traitance saisi pour le poste (HT). null = non saisi. */
  sstCostHt?: number | null;
  /** Marge nette HT après déduction du coût SST : marge HT − coût SST. */
  margeAvecSstHt?: number | null;
  /** Taux de marge affiné, SST inclus, en % du PV HT. */
  tauxMargeAvecSst?: number | null;
  /** Données manquantes, à compléter. Le calcul ne s'arrête pas pour autant. */
  issues: string[];
  complete: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineCostHt(line: FinanceLine): number | null {
  return line.costHt;
}

/**
 * `acceptZeroMo` : sur l'écran d'import, une main-d'œuvre à 0 € est acceptée sans motif
 * (coût saisi plus tard dans l'éditeur). L'éditeur garde la règle stricte par défaut.
 */
export function posteFinance(
  lines: FinanceLine[],
  opts: { acceptZeroMo?: boolean; sstCostHt?: number | null } = {},
): PosteFinance {
  const issues: string[] = [];
  const note = (msg: string) => {
    if (!issues.includes(msg)) issues.push(msg);
  };

  // PV HT / TTC : somme des lignes renseignées.
  const sumKnown = (xs: (number | null)[]) => {
    const known = xs.filter((x): x is number => x != null);
    return known.length > 0 ? round2(known.reduce((s, x) => s + x, 0)) : null;
  };
  for (const l of lines) if (l.ht == null) note("Montant HT manquant.");
  const pvHt = sumKnown(lines.map((l) => l.ht));
  const pvTtc = sumKnown(lines.map((l) => l.ttc));

  let blockedByZeroMo = false;
  const costs: number[] = [];
  for (const l of lines) {
    if (l.kind === "mo" && l.costHt === 0 && l.zeroCostReason == null && !opts.acceptZeroMo) {
      note("Main-d'œuvre à 0 € sans motif (remise ou SAV) : à signaler.");
      blockedByZeroMo = true;
      continue;
    }
    const cost = lineCostHt(l);
    // Prestation sans achat (SAV, remise) : coût 0 assumé, motif enregistré.
    if (cost == null && l.zeroCostReason != null) {
      costs.push(0);
      continue;
    }
    if (cost == null) {
      note(l.kind === "mo" ? "Coût de main-d'œuvre manquant." : "Prix d'achat manquant.");
    } else {
      costs.push(cost);
    }
  }
  const prixAchatHt =
    blockedByZeroMo || costs.length === 0 ? null : round2(costs.reduce((s, c) => s + c, 0));

  const achatFournituresHt = sumKnown(
    lines.filter((l) => l.kind === "fourniture").map((l) => l.costHt),
  );

  const margeHt = pvHt != null && prixAchatHt != null ? round2(pvHt - prixAchatHt) : null;
  const tauxMarge =
    margeHt != null && pvHt != null && pvHt > 0 ? round2((margeHt / pvHt) * 100) : null;

  const sstCostHt = opts.sstCostHt ?? null;
  const margeAvecSstHt = margeHt != null && sstCostHt != null ? round2(margeHt - sstCostHt) : null;
  const tauxMargeAvecSst =
    margeAvecSstHt != null && pvHt != null && pvHt > 0
      ? round2((margeAvecSstHt / pvHt) * 100)
      : null;

  const sumKind = (kind: FinanceLine["kind"]) =>
    sumKnown(lines.filter((l) => l.kind === kind).map((l) => l.ht));
  const moHt = sumKind("mo");
  const fournHt = sumKind("fourniture");
  const partMo = moHt != null && pvHt != null && pvHt > 0 ? round2((moHt / pvHt) * 100) : null;
  const partFournitures =
    fournHt != null && pvHt != null && pvHt > 0 ? round2((fournHt / pvHt) * 100) : null;

  return {
    pvHt,
    pvTtc,
    prixAchatHt,
    achatFournituresHt,
    margeHt,
    tauxMarge,
    sstCostHt,
    margeAvecSstHt,
    tauxMargeAvecSst,
    partMo,
    partFournitures,
    issues,
    complete:
      issues.length === 0 &&
      prixAchatHt != null &&
      tauxMarge != null &&
      partMo != null &&
      partFournitures != null,
  };
}

/** Synthèse du chantier : somme des postes. Un total n'inclut que les valeurs connues. */
export type ChantierFinance = {
  postes: number;
  postesComplets: number;
  /** Postes dont le coût SST est saisi (0 = pas encore de SST). */
  postesAvecSst: number;
  pvHt: number | null;
  achatFournituresHt: number | null;
  moCoutHt: number | null;
  sstCostHt: number | null;
  prixAchatHt: number | null;
  margeHt: number | null;
  tauxMarge: number | null;
  margeAvecSstHt: number | null;
  tauxMargeAvecSst: number | null;
};

export function chantierFinance(list: PosteFinance[]): ChantierFinance {
  const sum = (xs: (number | null | undefined)[]) => {
    const known = xs.filter((x): x is number => x != null);
    return known.length > 0 ? round2(known.reduce((s, x) => s + x, 0)) : null;
  };
  const pct = (num: number | null, base: number | null) =>
    num != null && base != null && base > 0 ? round2((num / base) * 100) : null;
  const pvHt = sum(list.map((f) => f.pvHt));
  const achatFournituresHt = sum(list.map((f) => f.achatFournituresHt));
  const prixAchatHt = sum(list.map((f) => f.prixAchatHt));
  const margeHt = sum(list.map((f) => f.margeHt));
  const sstCostHt = sum(list.map((f) => f.sstCostHt));
  const margeAvecSstHt = sum(list.map((f) => f.margeAvecSstHt));
  const moCoutHt =
    prixAchatHt != null && achatFournituresHt != null
      ? round2(prixAchatHt - achatFournituresHt)
      : null;
  return {
    postes: list.length,
    postesComplets: list.filter((f) => f.complete).length,
    postesAvecSst: list.filter((f) => f.sstCostHt != null).length,
    pvHt,
    achatFournituresHt,
    moCoutHt,
    sstCostHt,
    prixAchatHt,
    margeHt,
    tauxMarge: pct(margeHt, pvHt),
    margeAvecSstHt,
    tauxMargeAvecSst: pct(margeAvecSstHt, pvHt),
  };
}

/** Seuil de marge cible après sous-traitance, en %. En dessous, le poste est signalé. */
export const TARGET_MARGIN_PCT = 15;

/**
 * Prix de vente HT qui atteint le taux cible après SST : (prix de revient + SST) ÷ (1 − cible).
 * Null si le prix de revient ou la SST n'est pas connu : aucun prix n'est inventé.
 */
export function prixCiblePourTaux(
  prixAchatHt: number | null,
  sstCostHt: number | null,
  cibleEnPct: number = TARGET_MARGIN_PCT,
): number | null {
  if (prixAchatHt == null || sstCostHt == null || cibleEnPct >= 100) return null;
  return round2((prixAchatHt + sstCostHt) / (1 - cibleEnPct / 100));
}
