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
  const criteria: Array<{ ok: boolean; weight: number }> = [
    { ok: i.hasAddress, weight: 1 },
    { ok: i.hasPhone || i.hasEmail, weight: 1 },
    { ok: i.caLines > 0, weight: 2 },
    { ok: i.interventions > 0, weight: 2 },
    { ok: i.interventionsWithHours > 0 || i.historicHours > 0, weight: 2 },
    { ok: i.ceev > 0 || i.sst > 0, weight: 1 },
    { ok: i.recommendations > 0, weight: 1 },
  ];
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  const got = criteria.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);

  const gaps: QualityGap[] = [];
  if (i.caLines === 0) {
    gaps.push({ key: "ca", label: "Rapprocher des lignes CA", to: "/pilot/rapprochement" });
  }
  if (i.ceev === 0) {
    gaps.push({ key: "ceev", label: "Ajouter un contrat CEEV", to: "/pilot/ceev" });
  }
  if (i.interventions === 0) {
    gaps.push({ key: "interv", label: "Associer une intervention", to: "/interventions" });
  }
  if (i.interventions > 0 && i.interventionsWithHours === 0 && i.historicHours === 0) {
    gaps.push({ key: "hours", label: "Renseigner les heures réalisées", to: "/pilot/rapprochement" });
  }
  if (!i.hasAddress || (!i.hasPhone && !i.hasEmail)) {
    gaps.push({ key: "coords", label: "Compléter les coordonnées", to: `/clients/${clientId}` });
  }
  if (i.caLines > 0 && i.recommendations === 0) {
    gaps.push({ key: "presta", label: "Identifier une prestation à proposer", to: `/pilot/fiche/${clientId}` });
  }

  return {
    completeness: Math.round((got / total) * 100),
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