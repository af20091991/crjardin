// Pré-devis — indicateurs financiers par poste (pur).
// Règles validées : marge = PV HT − PAU HT ; taux = marge ÷ PV HT ; prix de vente du poste = somme des TTC ligne.
// Aucune charge retirée. Un indicateur dont la donnée manque est `null` (« données insuffisantes »), jamais 0.

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
  /** Prix de revient du poste : fournitures + main-d'œuvre saisie. */
  prixAchatHt: number | null;
  /** Achat HT des seules fournitures, reporté du catalogue : indépendant de la main-d'œuvre. */
  achatFournituresHt: number | null;
  margeHt: number | null;
  tauxMarge: number | null; // en %
  partMo: number | null; // en % du PV HT
  partFournitures: number | null; // en % du PV HT
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
  opts: { acceptZeroMo?: boolean } = {},
): PosteFinance {
  const issues: string[] = [];

  const pvHt = lines.every((l) => l.ht != null)
    ? round2(lines.reduce((s, l) => s + (l.ht as number), 0))
    : null;
  const pvTtc = lines.every((l) => l.ttc != null)
    ? round2(lines.reduce((s, l) => s + (l.ttc as number), 0))
    : null;

  let prixAchatHt: number | null = 0;
  for (const l of lines) {
    if (l.kind === "mo" && l.costHt === 0 && l.zeroCostReason == null && !opts.acceptZeroMo) {
      issues.push("Main-d'œuvre à 0 € sans motif (remise ou SAV) : à signaler.");
      prixAchatHt = null;
      continue;
    }
    const cost = lineCostHt(l);
    if (cost == null) {
      issues.push(l.kind === "mo" ? "Coût de main-d'œuvre manquant." : "Prix d'achat manquant.");
      prixAchatHt = null;
    } else if (prixAchatHt != null) {
      prixAchatHt += cost;
    }
  }
  if (prixAchatHt != null) prixAchatHt = round2(prixAchatHt);

  const fournCosts = lines.filter((l) => l.kind === "fourniture").map((l) => l.costHt);
  const achatFournituresHt = fournCosts.every((c) => c != null)
    ? round2(fournCosts.reduce<number>((s, c) => s + (c as number), 0))
    : null;

  const margeHt = pvHt != null && prixAchatHt != null ? round2(pvHt - prixAchatHt) : null;
  const tauxMarge =
    margeHt != null && pvHt != null && pvHt > 0 ? round2((margeHt / pvHt) * 100) : null;

  const sumKind = (kind: FinanceLine["kind"]) => {
    const subset = lines.filter((l) => l.kind === kind);
    if (!subset.every((l) => l.ht != null)) return null;
    return round2(subset.reduce((s, l) => s + (l.ht as number), 0));
  };
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
