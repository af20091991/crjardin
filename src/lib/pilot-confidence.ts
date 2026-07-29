// Score de confiance unique de Pilot Pro (V1.1).
//
// Toute donnée affichée peut être qualifiée par le même moteur : rapprochement
// client, contrat CEEV, ligne de sous-traitance, charge classée. Le score ne
// crée aucune donnée : il agrège des signaux déjà présents en base.
//
//   95 – 100 %  → fiable        (validé ou rapproché exactement)
//   70 – 94 %   → à vérifier    (rapprochement probable, catégorie déduite)
//   < 70 %      → incertain     (information manquante, décision requise)

export type ConfidenceLevel = "fiable" | "a_verifier" | "incertain";

export interface ConfidenceScore {
  score: number;
  level: ConfidenceLevel;
  /** Signaux manquants ou dégradés, formulés en langage métier. */
  reasons: string[];
}

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; badge: string; hint: string }
> = {
  fiable: {
    label: "Fiable",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    hint: "Donnée validée ou rapprochée à l'identique : exploitable telle quelle.",
  },
  a_verifier: {
    label: "À vérifier",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    hint: "Rapprochement probable ou catégorie déduite : un contrôle rapide suffit.",
  },
  incertain: {
    label: "Incertain",
    badge: "border-red-200 bg-red-50 text-red-700",
    hint: "Information manquante : une décision humaine est nécessaire.",
  },
};

export function levelOf(score: number): ConfidenceLevel {
  if (score >= 95) return "fiable";
  if (score >= 70) return "a_verifier";
  return "incertain";
}

export interface ConfidenceSignal {
  /** Poids du signal dans le score (somme libre, normalisée ensuite). */
  weight: number;
  ok: boolean;
  /** Explication affichée quand le signal est absent. */
  missing: string;
}

/** Agrège des signaux booléens pondérés en un score 0-100 traçable. */
export function scoreFromSignals(signals: ConfidenceSignal[]): ConfidenceScore {
  const total = signals.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return { score: 0, level: "incertain", reasons: ["Aucun signal disponible."] };
  const got = signals.reduce((s, x) => s + (x.ok ? x.weight : 0), 0);
  const score = Math.round((got / total) * 100);
  return {
    score,
    level: levelOf(score),
    reasons: signals.filter((s) => !s.ok).map((s) => s.missing),
  };
}

/** Confiance d'une ligne financière (pilot_ca_entries). */
export function caEntryConfidence(row: {
  validation_status?: string | null;
  match_status?: string | null;
  match_score?: number | null;
  charge_class?: string | null;
  charge_category?: string | null;
  client_id?: string | null;
  designation?: string | null;
}): ConfidenceScore {
  if (row.validation_status === "valide") {
    return { score: 100, level: "fiable", reasons: [] };
  }
  return scoreFromSignals([
    {
      weight: 3,
      ok: Boolean(row.client_id) || row.match_status === "identifie" || row.match_status === "manuel",
      missing: "Aucun client rattaché à cette ligne.",
    },
    {
      weight: 2,
      ok: Boolean(row.charge_category) && row.charge_category !== "À classer",
      missing: "Catégorie analytique non renseignée.",
    },
    {
      weight: 2,
      ok: Boolean(row.charge_class) && row.charge_class !== "a_classer",
      missing: "Charge non classée (fixe ou variable).",
    },
    {
      weight: 1,
      ok: Boolean((row.designation ?? "").trim()),
      missing: "Libellé d'origine absent.",
    },
  ]);
}

/** Confiance d'un contrat CEEV importé. */
export function ceevConfidence(row: {
  validation_status?: string | null;
  client_id?: string | null;
  match_status?: string | null;
  hours?: number | null;
  pv_ht?: number | null;
}): ConfidenceScore {
  if (row.validation_status === "valide" && row.client_id) {
    return { score: 100, level: "fiable", reasons: [] };
  }
  return scoreFromSignals([
    { weight: 4, ok: Boolean(row.client_id), missing: "Contrat non relié à une fiche client." },
    {
      weight: 2,
      ok: row.match_status === "identifie" || row.match_status === "manuel",
      missing: "Rapprochement client non confirmé.",
    },
    { weight: 2, ok: Number(row.pv_ht ?? 0) > 0, missing: "Prix de vente absent." },
    { weight: 1, ok: Number(row.hours ?? 0) > 0, missing: "Heures du contrat non renseignées." },
  ]);
}

/** Confiance d'une ligne de sous-traitance détectée dans les charges. */
export function sstLineConfidence(row: {
  confirmed?: boolean;
  provider?: string | null;
  clientName?: string | null;
  duplicateOfMission?: boolean;
}): ConfidenceScore {
  if (row.confirmed && !row.duplicateOfMission) return { score: 100, level: "fiable", reasons: [] };
  return scoreFromSignals([
    { weight: 4, ok: Boolean(row.confirmed), missing: "Prestataire non confirmé pour ce libellé." },
    {
      weight: 2,
      ok: Boolean(row.provider) && row.provider !== "Non identifié",
      missing: "Nom du prestataire illisible dans le libellé.",
    },
    { weight: 1, ok: Boolean(row.clientName), missing: "Client concerné inconnu." },
    {
      weight: 3,
      ok: !row.duplicateOfMission,
      missing: "Dépense déjà couverte par une mission SST : risque de double comptage.",
    },
  ]);
}