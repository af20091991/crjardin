// Règles de fiabilité des indicateurs stratégiques Pilot Pro.
// Principe : un KPI n'affiche JAMAIS une valeur calculée si les données
// nécessaires sont insuffisantes ou incohérentes. Il affiche alors un état
// explicite ("Non disponible", "Données insuffisantes", "Non calculable")
// accompagné d'une explication actionnable.

export type Reliable<T> =
  | { available: true; value: T; note?: string }
  | { available: false; label: string; detail: string };

export const RELIABILITY_RULES = {
  /** Part minimale d'interventions terminées avec heures confirmées. */
  MIN_HOURS_COVERAGE: 0.6,
  /** Nombre minimal d'interventions avec heures confirmées. */
  MIN_CONFIRMED_INTERVENTIONS: 3,
  /** Un taux horaire réel > cible × ce facteur est considéré aberrant. */
  MAX_RATE_FACTOR: 5,
  /** Plafond absolu de plausibilité (€/h) si aucune cible n'est définie. */
  ABSOLUTE_RATE_CAP: 500,
} as const;

/**
 * Taux horaire réel = CA HT / heures réellement confirmées
 * (interventions.hours_spent, statut "terminee"). Aucune estimation autorisée.
 */
export function realHourlyRate(params: {
  ca: number;
  confirmedHours: number;
  terminatedCount: number;
  confirmedCount: number;
  targetRate?: number;
}): Reliable<number> {
  const { ca, confirmedHours, terminatedCount, confirmedCount, targetRate = 0 } = params;
  const pending = Math.max(0, terminatedCount - confirmedCount);
  const unavailable = (detail: string): Reliable<number> => ({
    available: false,
    label: "Taux horaire réel indisponible",
    detail,
  });

  if (confirmedHours <= 0 || confirmedCount === 0) {
    return unavailable(
      `${terminatedCount} intervention${terminatedCount > 1 ? "s" : ""} terminée${terminatedCount > 1 ? "s" : ""} nécessite${terminatedCount > 1 ? "nt" : ""} une confirmation des heures.`,
    );
  }
  if (confirmedCount < RELIABILITY_RULES.MIN_CONFIRMED_INTERVENTIONS) {
    return unavailable(
      `Seulement ${confirmedCount} intervention${confirmedCount > 1 ? "s" : ""} avec heures confirmées — ${pending} en attente de confirmation.`,
    );
  }
  const coverage = terminatedCount > 0 ? confirmedCount / terminatedCount : 0;
  if (coverage < RELIABILITY_RULES.MIN_HOURS_COVERAGE) {
    return unavailable(
      `${pending} intervention${pending > 1 ? "s" : ""} terminée${pending > 1 ? "s" : ""} nécessite${pending > 1 ? "nt" : ""} une confirmation des heures (couverture ${Math.round(coverage * 100)} %).`,
    );
  }
  if (ca <= 0) {
    return unavailable("Aucun CA enregistré sur la période.");
  }
  const value = ca / confirmedHours;
  const cap =
    targetRate > 0
      ? targetRate * RELIABILITY_RULES.MAX_RATE_FACTOR
      : RELIABILITY_RULES.ABSOLUTE_RATE_CAP;
  if (!Number.isFinite(value) || value <= 0 || value > cap) {
    return unavailable(
      "Valeur incohérente au regard des heures saisies — confirmez les heures réelles avant analyse.",
    );
  }
  return {
    available: true,
    value,
    note: `Basé sur ${confirmedCount}/${terminatedCount} interventions terminées`,
  };
}

/** Marge : non calculable sans CA sur la période. */
export function marginPct(params: { ca: number; marge: number }): Reliable<number> {
  if (!(params.ca > 0)) {
    return {
      available: false,
      label: "Non calculable",
      detail: "Aucun CA enregistré sur la période.",
    };
  }
  return { available: true, value: params.marge };
}

/**
 * Comparaison de période : refusée si la période de référence est vide,
 * non comparable, ou si la période courante n'a encore aucune donnée.
 */
export function periodComparison(params: {
  current: number;
  previous: number;
  comparable?: boolean;
}): Reliable<number> {
  const { current, previous, comparable = true } = params;
  if (!comparable) {
    return { available: false, label: "Comparaison indisponible", detail: "Périodes non comparables." };
  }
  if (!(previous > 0)) {
    return {
      available: false,
      label: "Comparaison indisponible",
      detail: "Pas d'historique sur la période de référence.",
    };
  }
  if (!(current > 0)) {
    return {
      available: false,
      label: "À confirmer",
      detail: "Aucun CA saisi sur la période en cours — comparaison non significative.",
    };
  }
  return { available: true, value: ((current - previous) / previous) * 100 };
}