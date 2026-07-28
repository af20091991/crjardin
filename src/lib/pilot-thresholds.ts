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

  // ---- Seuils du score de Santé (pilot-health.ts) ----
  // Profil de référence : TPE paysagiste solo (un seul actif, clientèle
  // particuliers/collectivités, activité saisonnière avec creux hivernal).
  /** Marge nette (bénéfice / CA HT) considérée comme saine, plancher (%). Repère métier : 20–30 %. */
  margeSaineMin: number;
  /** Marge nette haute du plage saine (%), au-delà le score reste plafonné à 100. */
  margeSaineMax: number;
  /** Poids des charges d'exploitation / CA considéré comme sain, plafond (%). Au-delà, la structure de coûts doit être surveillée. */
  poidsChargesSain: number;
  /** Poids des charges / CA déclenchant une alerte franche (%). Au-delà, situation critique. */
  poidsChargesAlerte: number;
  /** Taux horaire facturé cible bas de la plage saine (€/h). Repère métier paysage : 45–60 €/h. */
  tauxHoraireCibleMin: number;
  /** Taux horaire facturé cible haut de la plage saine (€/h). */
  tauxHoraireCibleMax: number;
  /** Taux horaire facturé sous ce seuil : alerte (prix ou temps passé à revoir). */
  tauxHoraireAlerte: number;
  /** Part du 1er client dans le CA considérée comme saine (%), plafond. Au-delà, dépendance à surveiller. */
  concentrationClientSaine: number;
  /** Part du 1er client dans le CA déclenchant une alerte de dépendance (%). */
  concentrationClientAlerte: number;
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

  // TPE paysagiste solo : voir commentaires de l'interface ci-dessus.
  margeSaineMin: 20,
  margeSaineMax: 30,
  poidsChargesSain: 70,
  poidsChargesAlerte: 80,
  tauxHoraireCibleMin: 45,
  tauxHoraireCibleMax: 60,
  tauxHoraireAlerte: 40,
  concentrationClientSaine: 20,
  concentrationClientAlerte: 30,
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
  {
    key: "margeSaineMin",
    label: "Marge nette saine (plancher)",
    suffix: "%",
    help: "Repère TPE paysage : marge saine 20–30 % du CA.",
  },
  {
    key: "margeSaineMax",
    label: "Marge nette saine (plafond)",
    suffix: "%",
    help: "Au-delà, le score de marge reste plafonné à 100.",
  },
  {
    key: "poidsChargesSain",
    label: "Poids des charges sain (plafond)",
    suffix: "% du CA",
    help: "Sous ce seuil, la structure de coûts est saine.",
  },
  {
    key: "poidsChargesAlerte",
    label: "Poids des charges — alerte",
    suffix: "% du CA",
    help: "Au-delà, alerte sur le poids des charges d'exploitation.",
  },
  {
    key: "tauxHoraireCibleMin",
    label: "Taux horaire cible (bas)",
    suffix: "€/h",
    help: "Repère TPE paysage : taux horaire facturé cible 45–60 €/h.",
  },
  {
    key: "tauxHoraireCibleMax",
    label: "Taux horaire cible (haut)",
    suffix: "€/h",
    help: "Haut de la plage de taux horaire cible.",
  },
  {
    key: "tauxHoraireAlerte",
    label: "Taux horaire — alerte",
    suffix: "€/h",
    help: "Sous ce seuil, le prix ou le temps passé doit être revu.",
  },
  {
    key: "concentrationClientSaine",
    label: "Concentration 1er client saine",
    suffix: "% du CA",
    help: "Sous ce seuil, la dépendance à un client est maîtrisée.",
  },
  {
    key: "concentrationClientAlerte",
    label: "Concentration 1er client — alerte",
    suffix: "% du CA",
    help: "Au-delà, la dépendance à un client est un risque.",
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
