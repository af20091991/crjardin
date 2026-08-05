// Qualité d'une fiche client : complétude, confiance et éléments manquants.
// Uniquement à partir des données déjà enregistrées.

export interface ClientQualityInput {
  hasAddress: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  caLines: number;
  caAmount: number;
  interventions: number;
  interventionsWithHours: number;
  ceev: number;
  sst: number;
  historicHours: number;
  recommendations: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | null;
  lastQualifiedAt: string | null;
  /**
   * Politique compte-rendu du client. « non » signifie que l'absence
   * d'intervention n'est PAS un défaut de qualité : le client n'est pas suivi
   * par intervention/compte-rendu.
   */
  reportPolicy?: "oui" | "non" | "a_confirmer";
}

export interface QualityGap {
  key: string;
  label: string;
  /** Route interne permettant de compléter l'information. */
  to: string;
}

export interface ClientQuality {
  completeness: number; // 0..100
  confidenceLabel: string;
  /** Niveau lisible : n'empêche jamais l'utilisation de l'application. */
  level: "excellente" | "correcte" | "a_verifier";
  levelLabel: string;
  levelBadge: string;
  lastQualifiedAt: string | null;
  attachedCount: number;
  gaps: QualityGap[];
  hasAnyData: boolean;
}

const CONFIDENCE_LABEL: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "élevée",
  MEDIUM: "moyenne",
  LOW: "faible",
};

export function computeClientQuality(i: ClientQualityInput, clientId: string): ClientQuality {
  // Client non concerné par les comptes-rendus : les interventions ne sont pas
  // attendues, on ne pénalise donc ni la complétude ni la liste des manques.
  const interventionsExpected = i.reportPolicy !== "non";
  const hoursKnown = i.interventionsWithHours > 0 || i.historicHours > 0;
  const criteria: Array<{ ok: boolean; weight: number }> = [
    { ok: i.hasAddress, weight: 1 },
    { ok: i.hasPhone || i.hasEmail, weight: 1 },
    { ok: i.caLines > 0, weight: 2 },
    { ok: interventionsExpected ? i.interventions > 0 : true, weight: 2 },
    { ok: hoursKnown, weight: 2 },
    { ok: i.ceev > 0 || i.sst > 0, weight: 1 },
    { ok: i.recommendations > 0, weight: 1 },
  ];
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  const got = criteria.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const completeness = Math.round((got / total) * 100);
  const level: ClientQuality["level"] =
    completeness >= 80 ? "excellente" : completeness >= 55 ? "correcte" : "a_verifier";
  const LEVEL_META = {
    excellente: { label: "Qualité excellente", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    correcte: { label: "Qualité correcte", badge: "border-sky-200 bg-sky-50 text-sky-700" },
    a_verifier: { label: "À vérifier", badge: "border-orange-200 bg-orange-50 text-orange-800" },
  } as const;

  const gaps: QualityGap[] = [];
  if (i.caLines === 0) {
    gaps.push({ key: "ca", label: "Rapprocher des lignes CA", to: "/pilot/rapprochement" });
  }
  if (i.ceev === 0) {
    gaps.push({ key: "ceev", label: "Ajouter un contrat CEEV", to: "/pilot/ceev" });
  }
  if (interventionsExpected && i.interventions === 0) {
    gaps.push({ key: "interv", label: "Associer une intervention", to: "/interventions" });
  }
  if (i.interventions > 0 && !hoursKnown) {
    gaps.push({ key: "hours", label: "Renseigner les heures réalisées", to: "/pilot/rapprochement" });
  }
  if (!i.hasAddress || (!i.hasPhone && !i.hasEmail)) {
    gaps.push({ key: "coords", label: "Compléter les coordonnées", to: `/clients/${clientId}` });
  }
  if (i.caLines > 0 && i.recommendations === 0) {
    gaps.push({ key: "presta", label: "Identifier une prestation à proposer", to: `/pilot/fiche/${clientId}` });
  }

  return {
    completeness,
    level,
    levelLabel: LEVEL_META[level].label,
    levelBadge: LEVEL_META[level].badge,
    confidenceLabel: i.confidenceLevel ? CONFIDENCE_LABEL[i.confidenceLevel] : "non évaluée",
    lastQualifiedAt: i.lastQualifiedAt,
    attachedCount:
      i.caLines + i.interventions + i.ceev + i.sst + i.recommendations,
    gaps,
    hasAnyData:
      i.caLines > 0 ||
      i.interventions > 0 ||
      i.ceev > 0 ||
      i.sst > 0 ||
      i.historicHours > 0 ||
      i.recommendations > 0,
  };
}