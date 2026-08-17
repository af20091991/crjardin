// REGISTRE EXHAUSTIF DES CONTRÔLES DE DONNÉES (Centre de contrôle).
//
// MOTEUR PUR — aucune lecture, aucune écriture, aucun calcul métier.
// Objectif : plus aucune donnée « latente ». Chaque famille de données
// exploitée par Pilot Pro possède ici une définition de contrôle explicite
// (source, champ, consommateurs, période, règle de validité, règle de
// non-applicabilité, impact, action attendue). Une observation est ensuite
// évaluée pour produire UN statut explicite parmi :
//   certifie · partiel · a_confirmer · non_exploitable · indisponible ·
//   non_requis · non_applicable
//
// Règles de fiabilité non négociables :
//   • une absence n'est JAMAIS transformée en 0 (null reste null) ;
//   • une erreur de lecture n'est jamais présentée comme une absence ;
//   • un exercice antérieur au périmètre de certification est « non requis »
//     et ne dégrade jamais la couverture des exercices certifiables ;
//   • aucun statut « certifié » sans preuve chiffrée.

import type { ControlDomain } from "@/lib/pilot-control-queue";
import {
  HISTORY_OUT_OF_SCOPE_MESSAGE,
  isOutOfCertificationScope,
} from "@/lib/pilot-history-scope";

// ── Statuts ─────────────────────────────────────────────────────────────────

export type ControlStatus =
  | "certifie"
  | "partiel"
  | "a_confirmer"
  | "non_exploitable"
  | "indisponible"
  | "non_requis"
  | "non_applicable";

export const CONTROL_STATUS_LABEL: Record<ControlStatus, string> = {
  certifie: "Certifié",
  partiel: "Partiellement fiable",
  a_confirmer: "À confirmer",
  non_exploitable: "Non exploitable",
  indisponible: "Indisponible",
  non_requis: "Non requis",
  non_applicable: "Sans objet",
};

export const CONTROL_STATUS_HELP: Record<ControlStatus, string> = {
  certifie: "Contrôle exécuté sur des données réelles, sans écart : la donnée peut être utilisée.",
  partiel: "Une partie des éléments est fiable, le reste manque ou diverge.",
  a_confirmer: "Une proposition existe mais elle engage un choix métier : rien n'est appliqué seul.",
  non_exploitable: "Les données se contredisent : l'indicateur ne doit pas être utilisé.",
  indisponible: "La source n'a pas pu être lue : ce n'est pas une absence de donnée.",
  non_requis: HISTORY_OUT_OF_SCOPE_MESSAGE,
  non_applicable: "Le contrôle ne s'applique pas à ce périmètre (règle métier documentée).",
};

export const CONTROL_STATUS_RANK: Record<ControlStatus, number> = {
  non_exploitable: 0,
  indisponible: 1,
  partiel: 2,
  a_confirmer: 3,
  certifie: 4,
  non_applicable: 5,
  non_requis: 6,
};

/** Statuts qui interdisent d'annoncer une donnée fiable. */
export const BLOCKING_STATUSES: readonly ControlStatus[] = [
  "non_exploitable",
  "indisponible",
  "partiel",
];

/** Cause normalisée d'un écart : jamais « erreur inconnue ». */
export type ControlCause =
  | "rattachement_manquant"
  | "doublon"
  | "periode_incomplete"
  | "classification_manquante"
  | "montant_divergent"
  | "perimetre_documente"
  | "source_indisponible"
  | "absence_justifiee"
  | "divergence_calcul"
  | "aucune";

export const CONTROL_CAUSE_LABEL: Record<ControlCause, string> = {
  rattachement_manquant: "Rattachement manquant",
  doublon: "Doublon probable",
  periode_incomplete: "Période incomplète",
  classification_manquante: "Classement manquant",
  montant_divergent: "Montant divergent",
  perimetre_documente: "Écart de périmètre documenté",
  source_indisponible: "Source indisponible",
  absence_justifiee: "Absence justifiée",
  divergence_calcul: "Divergence de calcul",
  aucune: "Aucun écart",
};

export type ControlFamily =
  | "finance"
  | "temps"
  | "clients"
  | "sites"
  | "ceev"
  | "sst"
  | "moteurs";

export const CONTROL_FAMILY_LABEL: Record<ControlFamily, string> = {
  finance: "Finance",
  temps: "Temps",
  clients: "Référentiel clients",
  sites: "Sites & contacts",
  ceev: "Contrats CEEV",
  sst: "Sous-traitance",
  moteurs: "Moteurs de calcul",
};

// ── Définition d'un contrôle ────────────────────────────────────────────────

export interface ControlDefinition {
  id: string;
  family: ControlFamily;
  domain: ControlDomain;
  label: string;
  /** Table / source de vérité. */
  source: string;
  /** Champ(s) contrôlé(s). */
  field: string;
  /** Écrans et indicateurs qui consomment cette donnée. */
  consumers: string[];
  /** Période couverte par le contrôle. */
  period: string;
  /** Règle de validité (ce qui rend la donnée exploitable). */
  validity: string;
  /** Règle de non-applicabilité documentée (jamais implicite). */
  notApplicable: string;
  /** Conséquence métier si le contrôle échoue. */
  impact: string;
  /** Action attendue quand le contrôle n'est pas certifié. */
  action: string;
  /** Cause par défaut d'un écart sur ce contrôle. */
  cause: ControlCause;
  /** Vrai si l'échec empêche de certifier un KPI. */
  blocksKpi: boolean;
  kpi: string[];
  /** Écran de traitement. */
  to: string;
}

const def = (d: ControlDefinition): ControlDefinition => d;

/**
 * Registre exhaustif : toute donnée exploitée par Pilot Pro doit être
 * couverte par une ligne ci-dessous. Ajouter une source sans l'inscrire ici
 * est une régression (voir les tests du registre).
 */
export const CONTROL_REGISTRY: readonly ControlDefinition[] = [
  // ── Finance ───────────────────────────────────────────────────────────────
  def({
    id: "finance.ventes.montant",
    family: "finance",
    domain: "ca",
    label: "Montant HT des lignes de vente",
    source: "pilot_ca_entries (kind = vente)",
    field: "amount_ht",
    consumers: ["Chiffre d'affaires", "Direction", "Rentabilité", "Objectifs"],
    period: "Exercice sélectionné, à date",
    validity: "Montant numérique renseigné et date d'imputation ≤ aujourd'hui.",
    notApplicable: "Ligne annulée ou hors exercice sélectionné.",
    impact: "CA publié faux ou incomplet.",
    action: "Compléter le montant de la ligne dans Chiffre d'affaires.",
    cause: "montant_divergent",
    blocksKpi: true,
    kpi: ["CA HT", "Bénéfice", "Marge"],
    to: "/pilot/ca",
  }),
  def({
    id: "finance.ventes.statut",
    family: "finance",
    domain: "ca",
    label: "Statut d'encaissement des ventes",
    source: "pilot_ca_entries",
    field: "status",
    consumers: ["Chiffre d'affaires", "Direction"],
    period: "Exercice sélectionné",
    validity: "CA comptabilisé uniquement à partir du statut « réglé ».",
    notApplicable: "Lignes de charge (le statut ne s'applique pas).",
    impact: "CA anticipé ou oublié selon le statut réel.",
    action: "Mettre à jour le statut de la ligne.",
    cause: "periode_incomplete",
    blocksKpi: true,
    kpi: ["CA HT réalisé"],
    to: "/pilot/ca",
  }),
  def({
    id: "finance.charges.classement",
    family: "finance",
    domain: "charges",
    label: "Classement des charges (fixe / variable / investissement / rémunération)",
    source: "pilot_ca_entries (kind = charge)",
    field: "charge_class, charge_category",
    consumers: ["Charges", "Direction", "Rentabilité"],
    period: "Exercice sélectionné, à date",
    validity: "Chaque charge porte une classe explicite, différente de « à classer ».",
    notApplicable: "Aucune : toute charge doit être classée.",
    impact: "Bénéfice et marge faux tant qu'une charge reste non classée.",
    action: "Confirmer le classement proposé ou choisir la catégorie.",
    cause: "classification_manquante",
    blocksKpi: true,
    kpi: ["Charges fixes / variables", "Bénéfice", "Marge"],
    to: "/pilot/controle",
  }),
  def({
    id: "finance.charges.periode",
    family: "finance",
    domain: "charges",
    label: "Datation des charges du mois en cours",
    source: "pilot_ca_entries (kind = charge)",
    field: "entry_date, year, month",
    consumers: ["Direction", "Charges", "Santé"],
    period: "Mois en cours non terminé",
    validity: "Une charge sans date précise du mois en cours est exclue du réalisé.",
    notApplicable: "Mois clos : la règle ne s'applique plus.",
    impact: "Charges anticipées : bénéfice sous-évalué à date.",
    action: "Renseigner la date réelle de la charge.",
    cause: "periode_incomplete",
    blocksKpi: false,
    kpi: ["Charges à date", "Bénéfice à date"],
    to: "/pilot/charges",
  }),
  def({
    id: "finance.charges.fixes",
    family: "finance",
    domain: "charges",
    label: "Charges fixes récurrentes",
    source: "pilot_fixed_charges",
    field: "amount, frequency",
    consumers: ["Charges", "Simulations"],
    period: "Exercice sélectionné",
    validity: "Montant et fréquence renseignés.",
    notApplicable: "Charge désactivée.",
    impact: "Structure de coûts incomplète.",
    action: "Compléter la fiche de charge fixe.",
    cause: "classification_manquante",
    blocksKpi: false,
    kpi: ["Charges fixes"],
    to: "/pilot/charges",
  }),
  // ── Temps ─────────────────────────────────────────────────────────────────
  def({
    id: "temps.vente.heures",
    family: "temps",
    domain: "heures",
    label: "Temps saisi sur la ligne de vente (source unique)",
    source: "pilot_ca_entries",
    field: "hours",
    consumers: ["Taux horaire", "Rentabilité", "Analyse du temps", "Santé"],
    period: "Exercice sélectionné, à date",
    validity: "Temps renseigné sur chaque ligne de vente interne.",
    notApplicable: "Ligne sous-traitée : 0 h est une valeur valide.",
    impact: "Taux horaire non calculable sur le CA concerné.",
    action: "Saisir le temps réel de la prestation.",
    cause: "absence_justifiee",
    blocksKpi: true,
    kpi: ["Taux horaire réel", "Rentabilité"],
    to: "/pilot/ca",
  }),
  def({
    id: "temps.vente.type",
    family: "temps",
    domain: "heures",
    label: "Type d'intervention (interne / sous-traitée)",
    source: "pilot_ca_entries",
    field: "intervention_type",
    consumers: ["Taux horaire", "Rentabilité SST"],
    period: "Exercice sélectionné",
    validity: "Type renseigné : il conditionne la validité d'un temps à 0 h.",
    notApplicable: "Ligne de charge.",
    impact: "Impossible de distinguer une absence de temps d'une sous-traitance.",
    action: "Renseigner le type d'intervention.",
    cause: "classification_manquante",
    blocksKpi: false,
    kpi: ["Taux horaire réel"],
    to: "/pilot/ca",
  }),
  def({
    id: "temps.historique",
    family: "temps",
    domain: "heures",
    label: "Heures historiques (avant reprise)",
    source: "pilot_historic_hours",
    field: "hours",
    consumers: ["Comparatifs pluriannuels"],
    period: "Exercices antérieurs à la reprise",
    validity: "Conservé pour mémoire, jamais utilisé dans un calcul économique.",
    notApplicable: "Exercices certifiables : la source unique est la ligne de vente.",
    impact: "Aucun : donnée d'historique isolée.",
    action: "Aucune action requise.",
    cause: "absence_justifiee",
    blocksKpi: false,
    kpi: [],
    to: "/pilot/temps",
  }),
  // ── Référentiel clients ───────────────────────────────────────────────────
  def({
    id: "clients.rattachement.ca",
    family: "clients",
    domain: "clients",
    label: "Rattachement des lignes de CA à un client",
    source: "pilot_ca_entries",
    field: "client_id",
    consumers: ["Rentabilité client", "Fiche 360", "Score client"],
    period: "Exercice sélectionné",
    validity: "Chaque ligne exploitable porte un client certifié.",
    notApplicable: "Ligne marquée « non applicable » (vente hors client).",
    impact: "CA non imputé : rentabilité client incomplète.",
    action: "Rattacher la ligne au bon client.",
    cause: "rattachement_manquant",
    blocksKpi: true,
    kpi: ["CA par client", "Rentabilité client"],
    to: "/pilot/controle",
  }),
  def({
    id: "clients.certification",
    family: "clients",
    domain: "clients",
    label: "Certification des fiches clients économiques",
    source: "clients",
    field: "entity_status",
    consumers: ["Rentabilité", "Direction", "Portefeuille"],
    period: "Permanent",
    validity: "Fiche qualifiée client économique (et non simple contact).",
    notApplicable: "Fiche archivée.",
    impact: "Indicateurs stratégiques calculés sur des entités non qualifiées.",
    action: "Certifier la fiche depuis le référentiel client.",
    cause: "rattachement_manquant",
    blocksKpi: true,
    kpi: ["CA par client", "Score client"],
    to: "/pilot/controle",
  }),
  def({
    id: "clients.doublons",
    family: "clients",
    domain: "clients",
    label: "Doublons de fiches clients",
    source: "clients",
    field: "name (normalisé)",
    consumers: ["Rentabilité client", "Fiche 360"],
    period: "Permanent",
    validity: "Aucune paire de fiches quasi identiques non arbitrée.",
    notApplicable: "Fiches explicitement déclarées distinctes.",
    impact: "Historique dispersé, CA client sous-évalué.",
    action: "Comparer et fusionner les fiches (réversible).",
    cause: "doublon",
    blocksKpi: false,
    kpi: ["CA par client"],
    to: "/pilot/controle",
  }),
  // ── Sites & contacts ──────────────────────────────────────────────────────
  def({
    id: "sites.rattachement",
    family: "sites",
    domain: "clients",
    label: "Rattachement des sites à un client",
    source: "sites",
    field: "client_id",
    consumers: ["Sites & contacts", "Analyse par lieu"],
    period: "Permanent",
    validity: "Chaque site appartient à un client existant.",
    notApplicable: "Analyse par lieu non utilisée dans les KPI économiques.",
    impact: "Analyse par lieu indisponible (sans effet sur le CA).",
    action: "Qualifier le site.",
    cause: "rattachement_manquant",
    blocksKpi: false,
    kpi: [],
    to: "/pilot/sites",
  }),
  def({
    id: "sites.propositions",
    family: "sites",
    domain: "clients",
    label: "Propositions de regroupement de sites",
    source: "site_merge_proposals",
    field: "status",
    consumers: ["Sites & contacts"],
    period: "Permanent",
    validity: "Aucune proposition laissée en attente.",
    notApplicable: "Aucune proposition générée.",
    impact: "Regroupements connus non appliqués.",
    action: "Valider ou refuser la proposition.",
    cause: "doublon",
    blocksKpi: false,
    kpi: [],
    to: "/pilot/sites",
  }),
  // ── CEEV ──────────────────────────────────────────────────────────────────
  def({
    id: "ceev.rattachement",
    family: "ceev",
    domain: "ca",
    label: "Rattachement des contrats CEEV à un client",
    source: "ceev_contracts",
    field: "client_id",
    consumers: ["Contrats CEEV", "Fiche 360"],
    period: "Exercice contractuel",
    validity: "Chaque contrat pointe vers un client certifié.",
    notApplicable: "Contrat clôturé et archivé.",
    impact: "Récurrent contractuel non visible sur la fiche client.",
    action: "Rattacher le contrat au client.",
    cause: "rattachement_manquant",
    blocksKpi: false,
    kpi: ["CA récurrent"],
    to: "/pilot/ceev",
  }),
  def({
    id: "ceev.montant",
    family: "ceev",
    domain: "ca",
    label: "Montant et échéance des contrats CEEV",
    source: "ceev_contracts",
    field: "pv_ht, year",
    consumers: ["Contrats CEEV", "Projection"],
    period: "Exercice contractuel",
    validity: "Montant HT et exercice renseignés.",
    notApplicable: "Contrat en cours de rédaction.",
    impact: "Récurrent contractuel non chiffrable.",
    action: "Compléter le contrat.",
    cause: "montant_divergent",
    blocksKpi: false,
    kpi: ["CA récurrent"],
    to: "/pilot/ceev",
  }),
  // ── Sous-traitance ────────────────────────────────────────────────────────
  def({
    id: "sst.mission.client",
    family: "sst",
    domain: "sst",
    label: "Rattachement des missions de sous-traitance à un client",
    source: "subcontractor_missions",
    field: "client_id",
    consumers: ["Rentabilité SST", "Rentabilité client"],
    period: "Exercice sélectionné",
    validity: "Chaque mission désigne le client final.",
    notApplicable: "Mission interne sans refacturation.",
    impact: "Coût de sous-traitance non imputé au client.",
    action: "Rattacher la mission à un client.",
    cause: "rattachement_manquant",
    blocksKpi: true,
    kpi: ["Rentabilité client", "Marge de sous-traitance"],
    to: "/journal-sst",
  }),
  def({
    id: "sst.mission.cout",
    family: "sst",
    domain: "sst",
    label: "Coût des missions de sous-traitance",
    source: "subcontractor_missions",
    field: "cost",
    consumers: ["Rentabilité SST", "Charges"],
    period: "Exercice sélectionné",
    validity: "Coût renseigné et rapproché de la charge correspondante.",
    notApplicable: "Mission annulée.",
    impact: "Marge de sous-traitance fausse ou doublonnée.",
    action: "Confirmer le coût et son rapprochement.",
    cause: "montant_divergent",
    blocksKpi: false,
    kpi: ["Marge de sous-traitance"],
    to: "/journal-sst",
  }),
  def({
    id: "sst.libelle.prestataire",
    family: "sst",
    domain: "sst",
    label: "Correspondance libellé de charge → prestataire",
    source: "pilot_sst_label_map",
    field: "label, subcontractor_id",
    consumers: ["Rentabilité SST"],
    period: "Permanent",
    validity: "Chaque libellé récurrent est confirmé par l'utilisateur.",
    notApplicable: "Charge sans lien avec la sous-traitance.",
    impact: "Coûts de sous-traitance attribués au mauvais prestataire.",
    action: "Confirmer la correspondance.",
    cause: "rattachement_manquant",
    blocksKpi: false,
    kpi: ["Marge de sous-traitance"],
    to: "/journal-sst",
  }),
  // ── Moteurs de calcul ─────────────────────────────────────────────────────
  def({
    id: "moteurs.coherence",
    family: "moteurs",
    domain: "rentabilite",
    label: "Cohérence entre le moteur unique et les chemins de calcul",
    source: "pilot-engine · audit de cohérence",
    field: "CA, charges, bénéfice, heures",
    consumers: ["Tous les écrans de pilotage"],
    period: "Exercice sélectionné",
    validity: "Aucun écart au-delà de la tolérance d'arrondi.",
    notApplicable: "Aucune : le moteur est la seule chaîne autorisée.",
    impact: "Deux écrans peuvent afficher deux vérités différentes.",
    action: "Analyser la divergence avant toute publication.",
    cause: "divergence_calcul",
    blocksKpi: true,
    kpi: ["Tous les indicateurs financiers"],
    to: "/pilot/controle",
  }),
  def({
    id: "moteurs.reconciliation",
    family: "moteurs",
    domain: "rentabilite",
    label: "Réconciliation lignes → totaux → indicateurs",
    source: "pilot-reconciliation",
    field: "CA, charges, heures, taux horaire",
    consumers: ["Direction", "Finance", "Santé"],
    period: "Exercice sélectionné, à date",
    validity: "Chaque total publié est reconstituable depuis les lignes.",
    notApplicable: "Écart de périmètre documenté et assumé.",
    impact: "Un indicateur publié sans preuve n'est pas certifiable.",
    action: "Expliquer ou corriger l'écart.",
    cause: "divergence_calcul",
    blocksKpi: true,
    kpi: ["CA HT", "Charges", "Bénéfice", "Taux horaire"],
    to: "/pilot/controle",
  }),
  def({
    id: "moteurs.kpi.contrat",
    family: "moteurs",
    domain: "rentabilite",
    label: "Respect du contrat de vérité des KPI",
    source: "pilot-kpi-contract",
    field: "source, période, règle d'absence",
    consumers: ["Tous les indicateurs"],
    period: "Exercice sélectionné",
    validity: "Chaque KPI publié dispose d'une source et d'une règle d'absence.",
    notApplicable: "KPI hors périmètre de certification.",
    impact: "Indicateur affiché sans définition opposable.",
    action: "Documenter ou retirer l'indicateur.",
    cause: "divergence_calcul",
    blocksKpi: true,
    kpi: ["Contrat des KPI"],
    to: "/pilot/controle",
  }),
];

export function controlById(id: string): ControlDefinition | null {
  return CONTROL_REGISTRY.find((c) => c.id === id) ?? null;
}

// ── Observation & évaluation ────────────────────────────────────────────────

/**
 * Mesure réelle d'un contrôle. `null` signifie « inconnu » et n'est JAMAIS
 * assimilé à zéro.
 */
export interface ControlObservation {
  id: string;
  /** Nombre d'éléments réellement examinés (null = non mesuré). */
  analysed: number | null;
  /** Nombre d'éléments en écart (null = non mesuré). */
  failing: number | null;
  /** Montant examiné, quand la donnée est financière. */
  amountAnalysed?: number | null;
  /** Montant en écart (impact financier chiffré). */
  amountFailing?: number | null;
  /** Erreur de lecture de la source (≠ absence de donnée). */
  loadError?: string | null;
  /** Exercice concerné, pour la règle de périmètre. */
  year?: number | null;
  /** Le contrôle ne s'applique pas (règle documentée). */
  notApplicable?: boolean;
  /** Les écarts disposent d'une proposition à confirmer. */
  confirmable?: boolean;
  /** Les sources se contredisent : rien n'est exploitable. */
  contradictory?: boolean;
  /** Éléments de preuve affichés tels quels. */
  evidence?: string[];
}

export interface ControlResult {
  definition: ControlDefinition;
  status: ControlStatus;
  cause: ControlCause;
  /** Explication en langage métier, toujours renseignée. */
  message: string;
  analysed: number | null;
  failing: number | null;
  /** Part certifiée (0..100) ou null si non mesurable. */
  coveragePct: number | null;
  amountFailing: number | null;
  evidence: string[];
  blocksKpi: boolean;
}

const pctOf = (ok: number, total: number) => (total > 0 ? Math.round((ok / total) * 1000) / 10 : 100);
const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Évalue un contrôle : un statut explicite, jamais un vide silencieux. */
export function evaluateControl(
  definition: ControlDefinition,
  observation?: ControlObservation | null,
): ControlResult {
  const base = {
    definition,
    analysed: observation?.analysed ?? null,
    failing: observation?.failing ?? null,
    coveragePct: null as number | null,
    amountFailing: observation?.amountFailing ?? null,
    evidence: observation?.evidence ?? [],
    blocksKpi: definition.blocksKpi,
  };

  if (!observation) {
    return {
      ...base,
      status: "indisponible",
      cause: "source_indisponible",
      message: "Contrôle non exécuté : aucune mesure disponible pour cette source.",
      blocksKpi: definition.blocksKpi,
    };
  }
  if (observation.loadError) {
    return {
      ...base,
      status: "indisponible",
      cause: "source_indisponible",
      message: `Lecture impossible : ${observation.loadError}. Ce n'est pas une absence de donnée.`,
      evidence: [...base.evidence, observation.loadError],
    };
  }
  if (observation.notApplicable) {
    return {
      ...base,
      status: "non_applicable",
      cause: "perimetre_documente",
      message: definition.notApplicable,
      blocksKpi: false,
    };
  }
  if (isOutOfCertificationScope(observation.year ?? null)) {
    return {
      ...base,
      status: "non_requis",
      cause: "absence_justifiee",
      message: HISTORY_OUT_OF_SCOPE_MESSAGE,
      blocksKpi: false,
    };
  }
  if (observation.analysed == null || observation.failing == null) {
    return {
      ...base,
      status: "indisponible",
      cause: "source_indisponible",
      message: "Mesure incomplète : le nombre d'éléments examinés n'est pas connu (aucune valeur n'est supposée).",
    };
  }

  const ok = Math.max(0, observation.analysed - observation.failing);
  const coveragePct = pctOf(ok, observation.analysed);
  const amountNote =
    observation.amountFailing != null && observation.amountFailing !== 0
      ? ` — impact chiffré : ${euro(observation.amountFailing)}`
      : "";

  if (observation.contradictory) {
    return {
      ...base,
      status: "non_exploitable",
      cause: "divergence_calcul",
      coveragePct,
      message: `Les sources se contredisent sur ${observation.failing} élément(s)${amountNote}. L'indicateur ne doit pas être utilisé.`,
    };
  }
  if (observation.failing === 0) {
    return {
      ...base,
      status: "certifie",
      cause: "aucune",
      coveragePct: 100,
      message: `${observation.analysed} élément(s) contrôlé(s), aucun écart : ${definition.validity}`,
    };
  }
  return {
    ...base,
    status: observation.confirmable ? "a_confirmer" : "partiel",
    cause: definition.cause,
    coveragePct,
    message: observation.confirmable
      ? `${observation.failing} élément(s) disposent d'une proposition à confirmer${amountNote}.`
      : `${observation.failing} élément(s) sur ${observation.analysed} ne respectent pas la règle${amountNote}.`,
  };
}

// ── Rapport agrégé ──────────────────────────────────────────────────────────

export interface FamilySummary {
  family: ControlFamily;
  label: string;
  status: ControlStatus;
  counts: Record<ControlStatus, number>;
  /** Impact financier chiffré des écarts (null si aucun montant mesuré). */
  amountAtRisk: number | null;
  /** Contrôles dont l'impact financier n'est pas mesurable. */
  unquantified: number;
}

export interface RegistryReport {
  results: ControlResult[];
  families: FamilySummary[];
  counts: Record<ControlStatus, number>;
  /** Part de contrôles certifiés parmi ceux réellement requis. */
  certifiedPct: number;
  /** Contrôles requis (hors non requis / sans objet). */
  required: number;
  amountAtRisk: number | null;
  unquantified: number;
  blocking: boolean;
}

const emptyCounts = (): Record<ControlStatus, number> => ({
  certifie: 0,
  partiel: 0,
  a_confirmer: 0,
  non_exploitable: 0,
  indisponible: 0,
  non_requis: 0,
  non_applicable: 0,
});

export function worstControlStatus(list: readonly ControlStatus[]): ControlStatus {
  if (list.length === 0) return "non_applicable";
  return [...list].sort((a, b) => CONTROL_STATUS_RANK[a] - CONTROL_STATUS_RANK[b])[0];
}

/**
 * Construit le rapport complet du registre. Les contrôles sans observation
 * sont explicitement « indisponibles » : aucune donnée latente ne subsiste.
 */
export function buildRegistryReport(
  observations: readonly ControlObservation[],
  registry: readonly ControlDefinition[] = CONTROL_REGISTRY,
): RegistryReport {
  const byId = new Map(observations.map((o) => [o.id, o]));
  const results = registry.map((d) => evaluateControl(d, byId.get(d.id)));

  const counts = emptyCounts();
  let amountAtRisk: number | null = null;
  let unquantified = 0;
  for (const r of results) {
    counts[r.status] += 1;
    const risky = r.status === "partiel" || r.status === "a_confirmer" || r.status === "non_exploitable";
    if (!risky) continue;
    if (r.amountFailing == null) unquantified += 1;
    else amountAtRisk = (amountAtRisk ?? 0) + Math.abs(r.amountFailing);
  }

  const families: FamilySummary[] = (Object.keys(CONTROL_FAMILY_LABEL) as ControlFamily[])
    .map((family) => {
      const rows = results.filter((r) => r.definition.family === family);
      const fCounts = emptyCounts();
      let fAmount: number | null = null;
      let fUnquantified = 0;
      for (const r of rows) {
        fCounts[r.status] += 1;
        const risky =
          r.status === "partiel" || r.status === "a_confirmer" || r.status === "non_exploitable";
        if (!risky) continue;
        if (r.amountFailing == null) fUnquantified += 1;
        else fAmount = (fAmount ?? 0) + Math.abs(r.amountFailing);
      }
      return {
        family,
        label: CONTROL_FAMILY_LABEL[family],
        status: worstControlStatus(rows.map((r) => r.status)),
        counts: fCounts,
        amountAtRisk: fAmount,
        unquantified: fUnquantified,
      };
    })
    .filter((f) => Object.values(f.counts).some((n) => n > 0));

  const required = results.filter(
    (r) => r.status !== "non_requis" && r.status !== "non_applicable",
  ).length;
  const certifiedPct = required > 0 ? pctOf(counts.certifie, required) : 100;
  const blocking = results.some(
    (r) => r.blocksKpi && BLOCKING_STATUSES.includes(r.status),
  );

  return { results, families, counts, certifiedPct, required, amountAtRisk, unquantified, blocking };
}

// ── Preuve de réconciliation de bout en bout ────────────────────────────────

export type ChainStage = "lignes" | "sous_totaux" | "totaux" | "moteur" | "kpi" | "affichage";

export const CHAIN_STAGE_LABEL: Record<ChainStage, string> = {
  lignes: "Lignes source",
  sous_totaux: "Sous-totaux",
  totaux: "Totaux",
  moteur: "Moteur analytique",
  kpi: "Indicateur publié",
  affichage: "Valeur affichée",
};

export interface ChainStep {
  stage: ChainStage;
  /** null = valeur non mesurée (jamais remplacée par 0). */
  value: number | null;
}

export interface ChainLink {
  from: ChainStage;
  to: ChainStage;
  expected: number | null;
  actual: number | null;
  gap: number | null;
  relative: number | null;
  status: ControlStatus;
  cause: ControlCause;
  message: string;
}

export interface ChainProof {
  label: string;
  unit: string;
  links: ChainLink[];
  status: ControlStatus;
  /** Vrai si toute la chaîne est reconstituable, preuve à l'appui. */
  certifiable: boolean;
}

export const CHAIN_TOLERANCE = 0.01;

/** Compare chaque maillon de la chaîne et documente l'écart trouvé. */
export function buildChainProof(params: {
  label: string;
  unit?: string;
  steps: readonly ChainStep[];
  /** Écart accepté et documenté (périmètre volontairement réduit). */
  documentedGap?: number;
  tolerance?: number;
}): ChainProof {
  const unit = params.unit ?? "€";
  const tolerance = params.tolerance ?? CHAIN_TOLERANCE;
  const documented = Math.abs(params.documentedGap ?? 0);
  const links: ChainLink[] = [];

  for (let i = 1; i < params.steps.length; i += 1) {
    const prev = params.steps[i - 1];
    const cur = params.steps[i];
    if (prev.value == null || cur.value == null) {
      links.push({
        from: prev.stage,
        to: cur.stage,
        expected: prev.value,
        actual: cur.value,
        gap: null,
        relative: null,
        status: "indisponible",
        cause: "source_indisponible",
        message: `Comparaison impossible : ${CHAIN_STAGE_LABEL[prev.value == null ? prev.stage : cur.stage]} non mesuré (aucune valeur supposée).`,
      });
      continue;
    }
    const gap = cur.value - prev.value;
    const abs = Math.abs(gap);
    const relative = prev.value !== 0 ? abs / Math.abs(prev.value) : null;
    if (abs <= tolerance) {
      links.push({
        from: prev.stage,
        to: cur.stage,
        expected: prev.value,
        actual: cur.value,
        gap,
        relative,
        status: "certifie",
        cause: "aucune",
        message: `${CHAIN_STAGE_LABEL[cur.stage]} reconstitué depuis ${CHAIN_STAGE_LABEL[prev.stage].toLowerCase()} (écart ${abs.toFixed(2)} ${unit}).`,
      });
      continue;
    }
    const isDocumented = documented > 0 && Math.abs(abs - documented) <= tolerance;
    links.push({
      from: prev.stage,
      to: cur.stage,
      expected: prev.value,
      actual: cur.value,
      gap,
      relative,
      status: isDocumented ? "non_applicable" : "non_exploitable",
      cause: isDocumented ? "perimetre_documente" : "divergence_calcul",
      message: isDocumented
        ? `Écart de périmètre documenté de ${abs.toFixed(2)} ${unit} entre ${CHAIN_STAGE_LABEL[prev.stage].toLowerCase()} et ${CHAIN_STAGE_LABEL[cur.stage].toLowerCase()}.`
        : `Écart non expliqué de ${abs.toFixed(2)} ${unit} entre ${CHAIN_STAGE_LABEL[prev.stage].toLowerCase()} et ${CHAIN_STAGE_LABEL[cur.stage].toLowerCase()}.`,
    });
  }

  const status = worstControlStatus(links.map((l) => l.status));
  return {
    label: params.label,
    unit,
    links,
    status,
    certifiable: links.length > 0 && links.every((l) => l.status === "certifie" || l.status === "non_applicable"),
  };
}