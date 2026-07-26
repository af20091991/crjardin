// Seuils et règles de calcul centralisés (Pilot Pro v2 — Paramètres PP).
//
// Objectif : réduire les constantes codées en dur dans les modules d'analyse.
// Les valeurs sont modifiables depuis Paramètres > Pilot Pro et persistées
// localement ; les modules lisent TOUJOURS via `getThresholds()`.

import { useSyncExternalStore } from "react";

export interface PilotThresholds {
  /** Marge nette minimale acceptable (%). */
  margeMin: number;
  /** Écart maximal toléré entre taux horaire réel et cible (%). */
  ecartTauxMax: number;
  /** Hausse de charges considérée comme dérive (% vs exercice précédent). */
  deriveChargesPct: number;
  /** Baisse d'activité considérée comme alerte (% vs période précédente). */
  baisseActivitePct: number;
  /** Nombre d'heures minimum pour juger la rentabilité d'un client. */
  heuresMinClient: number;
  /** Nombre de lignes CA minimum pour juger une prestation. */
  lignesMinPrestation: number;
  /** Multiplicateur « très rentable » appliqué au taux horaire cible. */
  clientTresRentableRatio: number;
  /** Multiplicateur « à surveiller » appliqué au taux horaire cible. */
  clientSurveillerRatio: number;
}

export const DEFAULT_THRESHOLDS: PilotThresholds = {
  margeMin: 15,
  ecartTauxMax: 15,
  deriveChargesPct: 15,
  baisseActivitePct: 10,
  heuresMinClient: 10,
  lignesMinPrestation: 3,
  clientTresRentableRatio: 1.2,
  clientSurveillerRatio: 0.85,
};

export const THRESHOLD_FIELDS: {
  key: keyof PilotThresholds;
  label: string;
  suffix: string;
  help: string;
}[] = [
  {
    key: "margeMin",
    label: "Marge minimale acceptable",
    suffix: "%",
    help: "Sous ce seuil, une alerte rentabilité est levée.",
  },
  {
    key: "ecartTauxMax",
    label: "Écart taux horaire toléré",
    suffix: "%",
    help: "Écart maximal entre taux réel et taux cible.",
  },
  {
    key: "deriveChargesPct",
    label: "Dérive charges",
    suffix: "%",
    help: "Hausse des charges vs exercice précédent déclenchant une alerte.",
  },
  {
    key: "baisseActivitePct",
    label: "Baisse d'activité",
    suffix: "%",
    help: "Recul de CA déclenchant une alerte d'activité.",
  },
  {
    key: "heuresMinClient",
    label: "Heures minimum / client",
    suffix: "h",
    help: "En dessous, la rentabilité client n'est pas jugée.",
  },
  {
    key: "lignesMinPrestation",
    label: "Lignes minimum / prestation",
    suffix: "lignes",
    help: "En dessous, la prestation n'est pas classée.",
  },
  {
    key: "clientTresRentableRatio",
    label: "Ratio « très rentable »",
    suffix: "× cible",
    help: "Taux horaire client ≥ ratio × cible.",
  },
  {
    key: "clientSurveillerRatio",
    label: "Ratio « à surveiller »",
    suffix: "× cible",
    help: "Taux horaire client < ratio × cible.",
  },
];

const KEY = "pp.thresholds.v1";
let cache: PilotThresholds | null = null;
const listeners = new Set<() => void>();

export function getThresholds(): PilotThresholds {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw
      ? { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<PilotThresholds>) }
      : DEFAULT_THRESHOLDS;
  } catch {
    cache = DEFAULT_THRESHOLDS;
  }
  return cache;
}

export function saveThresholds(next: PilotThresholds): void {
  cache = { ...DEFAULT_THRESHOLDS, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* stockage indisponible : les seuils restent en mémoire */
  }
  listeners.forEach((l) => l());
}

export function useThresholds(): PilotThresholds {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getThresholds,
    () => DEFAULT_THRESHOLDS,
  );
}
