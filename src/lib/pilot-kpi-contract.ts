// Contrat de vérité des KPI Pilot Pro (documentation typée, lecture seule).
//
// AUCUN CALCUL ICI. Ce fichier ne contient que des MÉTADONNÉES décrivant des
// indicateurs qui existent déjà, et une référence textuelle vers la fonction
// source officielle (moteur existant). Il ne crée aucune seconde source de
// vérité et ne doit jamais être utilisé pour produire une valeur métier.

import type { KpiKey } from "@/lib/pilot-engine";

/** Catégorie métier de l'indicateur. */
export type KpiCategory =
  | "chiffre_affaires"
  | "charges"
  | "resultat"
  | "temps"
  | "rentabilite"
  | "objectifs"
  | "qualite";

/** Unité d'affichage — alignée sur `Kpi["unit"]` du moteur analytique. */
export type KpiUnit = "eur" | "heures" | "pct" | "eur_heure" | "nombre";

/**
 * Fiabilité documentaire du KPI :
 * - `certifie` : périmètre et source établis avec certitude ;
 * - `a_documenter` : indicateur existant dont le périmètre exact reste à confirmer ;
 * - `non_disponible` : indicateur référencé mais non produit aujourd'hui.
 */
export type KpiReliabilityStatus = "certifie" | "a_documenter" | "non_disponible";

export const KPI_RELIABILITY_LABEL: Record<KpiReliabilityStatus, string> = {
  certifie: "Certifié",
  a_documenter: "À documenter",
  non_disponible: "Non disponible",
};

export const KPI_CATEGORY_LABEL: Record<KpiCategory, string> = {
  chiffre_affaires: "Chiffre d'affaires",
  charges: "Charges",
  resultat: "Résultat",
  temps: "Temps",
  rentabilite: "Rentabilité",
  objectifs: "Objectifs",
  qualite: "Qualité des données",
};

/** Identifiants stables : ceux du moteur analytique + indicateurs documentés hors moteur. */
export type KpiContractId =
  | KpiKey
  | "ca_progression_ytd"
  | "projection_annuelle"
  | "synthese_annuelle"
  | "sante_globale"
  | "objectifs_avancement"
  | "qualite_globale";

export interface KpiContract {
  /** Identifiant stable, jamais renommé. */
  id: KpiContractId;
  /** Libellé français affiché. */
  label: string;
  category: KpiCategory;
  /** Tables / colonnes lues (source de données). */
  source: string[];
  /** Période couverte par l'indicateur. */
  period: string;
  /** Périmètre retenu (lignes prises en compte) + données exclues. */
  scope: string;
  /** Filtres appliqués avant agrégation. */
  filters: string[];
  /** Données explicitement exclues du périmètre. */
  excludes: string[];
  unit: KpiUnit;
  /** Référence — et uniquement la référence — vers la fonction source officielle. */
  calculationReference: string;
  /** Règle appliquée si les données sont absentes ou incomplètes. */
  missingDataRule: string;
  reliabilityStatus: KpiReliabilityStatus;
}

const FISCAL_YEAR = "Exercice fiscal sélectionné (année courante par défaut).";
const REAL_FILTER = "Mode réel : lignes dont la date est ≤ aujourd'hui.";
const ACCOUNTING_FILTER =
  "Règle de comptabilisation Facturé / Réglé (src/lib/pilot-sale-accounting.ts) : temps dès Facturé, CA à partir de Réglé.";

const CONTRACTS: KpiContract[] = [
  {
    id: "ca_annuel",
    label: "CA HT de l'exercice",
    category: "chiffre_affaires",
    source: ["pilot_ca_entries (kind = vente)"],
    period: FISCAL_YEAR,
    scope: "Toutes les lignes de vente de l'exercice, quelle que soit la certification du client.",
    filters: [REAL_FILTER, ACCOUNTING_FILTER],
    excludes: ["Lignes de charge", "Investissements", "Rémunération dirigeant"],
    unit: "eur",
    calculationReference: "buildAnalytics → kpis.ca_annuel (src/lib/pilot-engine.ts)",
    missingDataRule:
      "Aucune ligne : l'indicateur est affiché comme indisponible, jamais forcé à 0.",
    reliabilityStatus: "certifie",
  },
  {
    id: "ca_mois",
    label: "CA HT du mois",
    category: "chiffre_affaires",
    source: ["pilot_ca_entries (kind = vente)"],
    period: "Dernier mois réalisé de l'exercice.",
    scope: "Lignes de vente du mois de référence.",
    filters: [REAL_FILTER, ACCOUNTING_FILTER],
    excludes: ["Lignes de charge"],
    unit: "eur",
    calculationReference: "buildAnalytics → kpis.ca_mois (src/lib/pilot-engine.ts)",
    missingDataRule: "Mois sans vente comptabilisée : 0 affiché comme valeur réelle du mois.",
    reliabilityStatus: "certifie",
  },
  {
    id: "ca_analytique",
    label: "CA HT certifié",
    category: "chiffre_affaires",
    source: ["pilot_ca_entries", "clients.entity_status"],
    period: FISCAL_YEAR,
    scope:
      "CA porté par une entité économique exploitable (certification appliquée avant agrégation).",
    filters: [REAL_FILTER, "Entité économique certifiée"],
    excludes: ["Ventes non rattachées à un client", "Fiches en attente de certification"],
    unit: "eur",
    calculationReference: "buildAnalytics → kpis.ca_analytique (src/lib/pilot-engine.ts)",
    missingDataRule:
      "Certification incomplète : le KPI expose ses motifs et peut passer en attente de certification.",
    reliabilityStatus: "certifie",
  },
  {
    id: "ca_progression_ytd",
    label: "Progression du CA à date (N vs N-1)",
    category: "chiffre_affaires",
    source: ["pilot_ca_entries (kind = vente)"],
    period: "Cumul à date de l'exercice, comparé à la même date de l'exercice précédent.",
    scope: "Cumuls YTD des deux exercices sur période équivalente.",
    filters: [REAL_FILTER],
    excludes: ["Mois postérieurs à aujourd'hui"],
    unit: "pct",
    calculationReference:
      "buildAnalytics → ca.progressionPct (src/lib/pilot-engine.ts) ; comparaison : toDateVsSameDateLastYear (src/lib/pilot-compare.ts)",
    missingDataRule:
      "Exercice précédent sans CA : progression non calculée (null), aucune valeur substituée.",
    reliabilityStatus: "certifie",
  },
  {
    id: "charges",
    label: "Charges d'exploitation",
    category: "charges",
    source: ["pilot_ca_entries (kind = charge)"],
    period: FISCAL_YEAR,
    scope: "Charges d'exploitation de l'exercice.",
    filters: [REAL_FILTER, "operatingCharges : charges d'exploitation uniquement"],
    excludes: ["Investissements (is_investment)", "Rémunération dirigeant"],
    unit: "eur",
    calculationReference:
      "buildAnalytics → kpis.charges (src/lib/pilot-engine.ts) ; normalisation : operatingCharges (src/lib/pilot-charges.ts)",
    missingDataRule:
      "Aucune charge enregistrée : l'exercice est signalé comme incomplet (chargesComplete = false).",
    reliabilityStatus: "certifie",
  },
  {
    id: "benefice_brut",
    label: "Bénéfice brut",
    category: "resultat",
    source: ["pilot_ca_entries"],
    period: FISCAL_YEAR,
    scope: "CA HT de l'exercice − charges d'exploitation de l'exercice.",
    filters: [REAL_FILTER],
    excludes: ["Investissements"],
    unit: "eur",
    calculationReference: "buildAnalytics → kpis.benefice_brut (src/lib/pilot-engine.ts)",
    missingDataRule:
      "Aucune charge enregistrée : bénéfice non calculable (null) plutôt qu'égal au CA.",
    reliabilityStatus: "certifie",
  },
  {
    id: "marge",
    label: "Marge brute",
    category: "resultat",
    source: ["pilot_ca_entries"],
    period: FISCAL_YEAR,
    scope: "Bénéfice brut rapporté au CA HT de l'exercice.",
    filters: [REAL_FILTER],
    excludes: ["Investissements"],
    unit: "pct",
    calculationReference: "buildAnalytics → kpis.marge (src/lib/pilot-engine.ts)",
    missingDataRule: "CA nul ou charges absentes : marge non produite (null).",
    reliabilityStatus: "certifie",
  },
  {
    id: "resultat_apres_investissements",
    label: "Résultat après investissements",
    category: "resultat",
    source: ["pilot_ca_entries", "pilot_ca_entries.is_investment"],
    period: FISCAL_YEAR,
    scope: "Bénéfice brut − investissements qualifiés de l'exercice.",
    filters: [REAL_FILTER],
    excludes: ["Charges non qualifiées d'investissement"],
    unit: "eur",
    calculationReference:
      "buildAnalytics → kpis.resultat_apres_investissements (src/lib/pilot-engine.ts)",
    missingDataRule: "Charges absentes : résultat non calculable (null).",
    reliabilityStatus: "certifie",
  },
  {
    id: "synthese_annuelle",
    label: "Synthèse pluriannuelle (Direction)",
    category: "resultat",
    source: ["pilot_ca_entries (ventes et charges)"],
    period: "Un exercice par année réellement présente dans les données.",
    scope: "CA, charges, bénéfice brut, investissements et résultat par exercice.",
    filters: [REAL_FILTER],
    excludes: ["Années sans donnée (jamais inventées)"],
    unit: "eur",
    calculationReference: "annualSummary (src/lib/pilot-annual.ts)",
    missingDataRule:
      "Exercice sans charge : marqué chargesComplete = false et exclu des lectures de marge.",
    reliabilityStatus: "certifie",
  },
  {
    id: "heures_vendues",
    label: "Heures d'intervention (Vente → Temps)",
    category: "temps",
    source: ["pilot_ca_entries.hours"],
    period: FISCAL_YEAR,
    scope: "Colonne Temps des lignes de vente de l'exercice — source unique des heures.",
    filters: [REAL_FILTER, "Temps comptabilisé dès le statut Facturé"],
    excludes: [
      "interventions.hours_spent",
      "pilot_historic_hours",
      "Heures estimées ou reconstituées",
    ],
    unit: "heures",
    calculationReference: "resolveRealHours → vendues (src/lib/pilot-real-hours.ts)",
    missingDataRule:
      "Aucune heure saisie : 0 h est une valeur métier valide (ventes SST), pas une absence de donnée.",
    reliabilityStatus: "certifie",
  },
  {
    id: "heures_reelles",
    label: "Heures d'intervention retenues",
    category: "temps",
    source: ["pilot_ca_entries.hours (Vente → Temps)"],
    period: FISCAL_YEAR,
    scope: "Heures retenues pour tous les calculs métier.",
    filters: [REAL_FILTER],
    excludes: ["Toute autre source d'heures"],
    unit: "heures",
    calculationReference: "resolveRealHours → hours (src/lib/pilot-real-hours.ts)",
    missingDataRule:
      "Aucune heure Vente → Temps : indicateur indisponible (null), aucun repli sur l'historique.",
    reliabilityStatus: "certifie",
  },
  {
    id: "taux_horaire_vendu",
    label: "Taux horaire vendu",
    category: "rentabilite",
    source: ["pilot_ca_entries"],
    period: FISCAL_YEAR,
    scope: "CA HT des lignes retenues ÷ Temps des mêmes lignes retenues (périmètre identique).",
    filters: [REAL_FILTER, "saleRateScope : CA et temps issus des mêmes lignes"],
    excludes: ["Lignes hors périmètre du taux", "Charges"],
    unit: "eur_heure",
    calculationReference:
      "buildAnalytics → kpis.taux_horaire_vendu (src/lib/pilot-engine.ts) ; périmètre : saleRateScope (src/lib/pilot-sale-time.ts)",
    missingDataRule: "Temps interne nul : taux non produit (null) plutôt qu'une division forcée.",
    reliabilityStatus: "certifie",
  },
  {
    id: "taux_horaire_reel",
    label: "Taux horaire réel",
    category: "rentabilite",
    source: ["pilot_ca_entries", "pilot_ca_entries.hours (Vente → Temps)"],
    period: FISCAL_YEAR,
    scope:
      "CA du périmètre ÷ temps interne du même périmètre (ventes SST à 0 h : CA compté, 0 h ajoutée).",
    filters: [REAL_FILTER, "Certification du référentiel en mode strict"],
    excludes: ["Heures hors Vente → Temps"],
    unit: "eur_heure",
    calculationReference: "buildAnalytics → kpis.taux_horaire_reel (src/lib/pilot-engine.ts)",
    missingDataRule:
      "Référentiel non certifié en mode strict : indicateur mis en attente de certification.",
    reliabilityStatus: "certifie",
  },
  {
    id: "classement_clients",
    label: "Classement clients",
    category: "rentabilite",
    source: ["pilot_ca_entries", "clients.entity_status", "registre des heures"],
    period: FISCAL_YEAR,
    scope: "Entités certifiées uniquement, triées par rentabilité via le moteur unique.",
    filters: [REAL_FILTER, "Entités économiques certifiées"],
    excludes: ["Ventes non rattachées", "Fiches non certifiées"],
    unit: "nombre",
    calculationReference:
      "buildAnalytics → kpis.classement_clients (src/lib/pilot-engine.ts) ; portefeuille : buildPortfolio (src/lib/pilot-portfolio.ts)",
    missingDataRule:
      "Aucune entité certifiée : classement vide et motifs de certification affichés.",
    reliabilityStatus: "certifie",
  },
  {
    id: "score_client",
    label: "Scores économiques clients",
    category: "rentabilite",
    source: ["clients", "pilot_ca_entries", "interventions"],
    period: FISCAL_YEAR,
    scope: "Score économique calculé après certification du référentiel.",
    filters: ["Certification du référentiel"],
    excludes: ["Clients non certifiés"],
    unit: "nombre",
    calculationReference:
      "buildAnalytics → kpis.score_client (src/lib/pilot-engine.ts) ; score : src/lib/client-score.ts",
    missingDataRule: "Référentiel incomplet : score mis en attente de certification.",
    reliabilityStatus: "certifie",
  },
  {
    id: "projection_annuelle",
    label: "Projection de fin d'exercice",
    category: "chiffre_affaires",
    source: ["pilot_ca_entries (kind = vente)"],
    period: "Exercice en cours, extrapolé à partir des mois écoulés.",
    scope:
      "Mode transmis explicitement à projectYear : « reel » = réalisé à date sans extrapolation ; « projection » = réalisé à date + extrapolation des mois restants. Base réelle identique dans les deux modes (date ≤ date de référence).",
    filters: [REAL_FILTER],
    excludes: [
      "Mode réel : la projection n'est pas un indicateur réalisé",
      "Investissements (is_investment) — exclus dans les deux chemins d'appel (règle buildAnalytics)",
      "Rémunération dirigeant (kind = remuneration), suivie séparément",
      "Saisies datées après la date de référence (jamais comptées comme réalisé)",
    ],
    unit: "eur",
    calculationReference:
      "projectYear (src/lib/pilot-projection.ts) ; variante historique : computeKpis → projection (src/lib/pilot.ts)",
    missingDataRule: "Données insuffisantes : projection non affichée en mode réel.",
    reliabilityStatus: "certifie",
  },
  {
    id: "sante_globale",
    label: "Score de santé économique",
    category: "qualite",
    source: ["Indicateurs consolidés du moteur analytique", "src/lib/pilot-thresholds.ts"],
    period: FISCAL_YEAR,
    scope: "Score par axes (marge, poids des charges, taux horaire, concentration) en mode réel.",
    filters: [REAL_FILTER],
    excludes: ["Valeurs projetées"],
    unit: "nombre",
    calculationReference: "pragmaticHealth (src/lib/pilot-health.ts)",
    missingDataRule: "Axe non calculable : score de l'axe null, jamais remplacé par 0.",
    reliabilityStatus: "certifie",
  },
  {
    id: "objectifs_avancement",
    label: "Avancement des objectifs",
    category: "objectifs",
    source: ["pilot_goals"],
    period: "Objectifs actifs, hors objectifs abandonnés.",
    scope: "Objectifs terminés rapportés aux objectifs actifs.",
    filters: ["Statut ≠ abandonné"],
    excludes: ["Objectifs abandonnés"],
    unit: "pct",
    calculationReference: "computeGoalStats (src/lib/pilot-goals.ts)",
    missingDataRule: "Aucun objectif actif : taux d'avancement à 0 % (aucun objectif à suivre).",
    reliabilityStatus: "certifie",
  },
  {
    id: "qualite_globale",
    label: "Score global de qualité des données",
    category: "qualite",
    source: [
      "clients",
      "pilot_ca_entries",
      "ceev_contracts",
      "subcontractor_missions",
      "interventions",
      "recommendations",
      "pilot_historic_hours",
    ],
    period: "État courant du référentiel (non borné à un exercice).",
    scope: "Taux de complétude par thème, agrégés en score global.",
    filters: ["Aucun filtre d'exercice"],
    excludes: ["Aucune exclusion : le rapport couvre l'ensemble du référentiel"],
    unit: "pct",
    calculationReference: "buildDataQualityReport (src/lib/pilot-data-quality.ts)",
    missingDataRule:
      "Lecture en erreur : le panneau affiche l'erreur et propose une nouvelle tentative, sans score de repli.",
    reliabilityStatus: "certifie",
  },
];

/** Registre central — métadonnées seules, aucune formule. */
export const KPI_CONTRACTS: readonly KpiContract[] = CONTRACTS;

export type KpiContractLookup =
  | { found: true; contract: KpiContract }
  | { found: false; id: string; reason: string };

/** Accès par identifiant. Un identifiant inconnu renvoie un état explicite. */
export function getKpiContract(id: string): KpiContractLookup {
  const contract = CONTRACTS.find((c) => c.id === id);
  if (!contract) {
    return {
      found: false,
      id,
      reason: `Indicateur « ${id} » absent du contrat de vérité : non documenté, aucune valeur de repli.`,
    };
  }
  return { found: true, contract };
}

/** Sous-ensemble par catégorie (usage documentaire / affichage). */
export function kpiContractsByCategory(category: KpiCategory): KpiContract[] {
  return CONTRACTS.filter((c) => c.category === category);
}
