// Lecture de fiabilité des KPI Pilot Pro — AUCUN CALCUL MÉTIER.
//
// Ce module ne fait que croiser trois sources déjà existantes :
//  1. le contrat de vérité (src/lib/pilot-kpi-contract.ts) — métadonnées ;
//  2. l'état des indicateurs déjà produits par le moteur (Kpi.status) ;
//  3. l'état de chargement des ressources (src/lib/pilot-data-state.ts).
// Il ne recalcule ni CA, ni charges, ni résultat, ni marge, ni heures, ni
// rentabilité, ni projection : il lit les valeurs telles quelles.

import type { AnalyticsSnapshot, KpiKey } from "@/lib/pilot-engine";
import type { DataStatus } from "@/lib/pilot-data-state";
import type { KpiContract, KpiContractId } from "@/lib/pilot-kpi-contract";
import type { IntegrityStatus } from "@/lib/pilot-integrity";
import { HISTORY_OUT_OF_SCOPE_MESSAGE, isOutOfCertificationScope } from "@/lib/pilot-history-scope";

/** Aptitude d'usage d'un KPI, du point de vue du dirigeant. */
export type KpiReadiness =
  | "certifie"
  | "partiel"
  | "a_confirmer"
  | "non_exploitable"
  | "non_disponible"
  | "non_requis";

export const KPI_READINESS_LABEL: Record<KpiReadiness, string> = {
  certifie: "Certifié",
  partiel: "Partiel",
  a_confirmer: "À confirmer",
  non_exploitable: "Non exploitable",
  non_disponible: "Non disponible",
  non_requis: "Non requis (hors périmètre)",
};

export interface KpiReliabilityRow {
  contract: KpiContract;
  readiness: KpiReadiness;
  /** Explication courte affichée dès que le KPI n'est pas certifié. */
  explanation: string;
  /** Précisions de lecture (valeurs déjà produites ailleurs, jamais recalculées). */
  details: string[];
}

/** Libellé officiel de `monthsObserved` — logique inchangée dans ce chantier. */
export const MONTHS_OBSERVED_LABEL = "Mois calendaires écoulés jusqu'à la date de référence";

const ENGINE_KEYS: ReadonlySet<string> = new Set<KpiKey>([
  "ca_annuel",
  "ca_mois",
  "ca_analytique",
  "heures_vendues",
  "heures_reelles",
  "charges",
  "benefice_brut",
  "marge",
  "resultat_apres_investissements",
  "taux_horaire_vendu",
  "taux_horaire_reel",
  "classement_clients",
  "score_client",
]);

function isEngineKpi(id: KpiContractId): id is KpiKey {
  return ENGINE_KEYS.has(id);
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export interface KpiReliabilityInput {
  contracts: readonly KpiContract[];
  /** Instantané déjà calculé par le moteur unique (jamais reconstruit ici). */
  snapshot: AnalyticsSnapshot | null;
  /** État le plus dégradé du socle de données Pilot Pro. */
  dataStatus: DataStatus;
  dataMessage: string;
  /** État de la lecture du rapport de qualité des données. */
  qualityStatus: DataStatus;
  qualityMessage: string;
  /**
   * État d'intégrité global des sources critiques (contrôles de fiabilité).
   * Un KPI ne peut jamais être présenté comme certifié si ses sources ne le
   * sont pas : ce plafond s'applique après les contrôles du moteur.
   */
  integrityStatus?: IntegrityStatus;
  integrityMessage?: string;
  /**
   * Exercice lu. Un exercice antérieur au périmètre de certification (avant
   * 2026) ne produit ni erreur ni anomalie : ses KPI sont « non requis ».
   */
  year?: number | null;
}

/** État de chargement traduit en aptitude d'usage, si celui-ci est bloquant. */
function readinessFromStatus(
  status: DataStatus,
  message: string,
): { readiness: KpiReadiness; explanation: string } | null {
  if (status === "error")
    return { readiness: "non_disponible", explanation: `Lecture en erreur — ${message}` };
  if (status === "loading")
    return { readiness: "non_disponible", explanation: `Chargement en cours — ${message}` };
  if (status === "empty")
    return { readiness: "non_exploitable", explanation: `Aucune donnée disponible — ${message}` };
  if (status === "stale")
    return { readiness: "partiel", explanation: `Données potentiellement périmées — ${message}` };
  return null;
}

export function buildKpiReliability(input: KpiReliabilityInput): KpiReliabilityRow[] {
  const { contracts, snapshot, dataStatus, dataMessage, qualityStatus, qualityMessage } = input;
  // Historique hors périmètre : absence assumée, jamais un défaut de fiabilité.
  if (isOutOfCertificationScope(input.year)) {
    return contracts.map<KpiReliabilityRow>((contract) => ({
      contract,
      readiness: "non_requis",
      explanation: HISTORY_OUT_OF_SCOPE_MESSAGE,
      details: [],
    }));
  }
  const loadIssue = readinessFromStatus(dataStatus, dataMessage);
  const qualityIssue = readinessFromStatus(qualityStatus, qualityMessage);
  const integrityCap = integrityIssue(input.integrityStatus, input.integrityMessage);

  const rows = contracts.map<KpiReliabilityRow>((contract) => {
    // Indicateur documenté comme non produit : l'état du chargement n'y change rien.
    if (contract.reliabilityStatus === "non_disponible") {
      return {
        contract,
        readiness: "non_disponible",
        explanation: "Indicateur référencé au contrat mais non produit aujourd'hui.",
        details: [],
      };
    }

    const isQuality = contract.id === "qualite_globale";
    const issue = isQuality ? qualityIssue : loadIssue;
    if (issue) {
      return { contract, readiness: issue.readiness, explanation: issue.explanation, details: [] };
    }

    if (contract.id === "projection_annuelle") {
      return projectionRow(contract, snapshot);
    }

    if (isEngineKpi(contract.id)) {
      const kpi = snapshot ? snapshot.kpis[contract.id] : null;
      if (!kpi) {
        return {
          contract,
          readiness: "non_disponible",
          explanation: "Instantané analytique non disponible.",
          details: [],
        };
      }
      if (kpi.status === "en_attente_certification") {
        return {
          contract,
          readiness: "a_confirmer",
          explanation: kpi.reasons[0] ?? "En attente de certification du référentiel client.",
          details: kpi.reasons.slice(1),
        };
      }
      if (kpi.status === "indisponible" || kpi.value === null) {
        return {
          contract,
          readiness: "non_exploitable",
          explanation: kpi.reasons[0] ?? contract.missingDataRule,
          details: kpi.reasons.slice(1),
        };
      }
      return { contract, readiness: "certifie", explanation: "", details: [] };
    }

    // Indicateurs documentés hors moteur : le contrat reste la référence.
    if (contract.reliabilityStatus === "a_documenter") {
      return {
        contract,
        readiness: "a_confirmer",
        explanation: "Périmètre exact de l'indicateur restant à confirmer au contrat.",
        details: [],
      };
    }
    return { contract, readiness: "certifie", explanation: "", details: [] };
  });

  if (!integrityCap) return rows;
  // Plafond de certification : aucun badge « Certifié » sur des sources
  // incomplètes, suspectes ou indisponibles.
  return rows.map((row) =>
    row.readiness === "certifie"
      ? { ...row, readiness: integrityCap.readiness, explanation: integrityCap.explanation }
      : row,
  );
}

/** Traduction de l'intégrité des sources en plafond d'aptitude d'usage. */
function integrityIssue(
  status: IntegrityStatus | undefined,
  message: string | undefined,
): { readiness: KpiReadiness; explanation: string } | null {
  if (!status || status === "certifie") return null;
  const why = message ?? "Contrôles de fiabilité des sources non passés.";
  if (status === "indisponible")
    return { readiness: "non_disponible", explanation: `Sources indisponibles — ${why}` };
  if (status === "suspect")
    return { readiness: "a_confirmer", explanation: `Sources suspectes — ${why}` };
  return { readiness: "partiel", explanation: `Sources incomplètes — ${why}` };
}

/**
 * `projection_annuelle` : lecture stricte du résultat déjà produit par
 * `projectYear`. Le réalisé à date, la projection et les mois calendaires
 * écoulés restent trois informations distinctes.
 */
function projectionRow(
  contract: KpiContract,
  snapshot: AnalyticsSnapshot | null,
): KpiReliabilityRow {
  const p = snapshot?.projection ?? null;
  if (!p) {
    return {
      contract,
      readiness: "non_disponible",
      explanation: "Instantané analytique non disponible.",
      details: [],
    };
  }
  const details = [
    `Réalisé à date : ${eur(p.caReel)} (aucune donnée future comptée)`,
    p.method === "aucune"
      ? "Projection : non produite (mode réel ou données insuffisantes)"
      : `Projection fin d'exercice : ${eur(p.caProjete)} (méthode ${p.method})`,
    `${MONTHS_OBSERVED_LABEL} : ${p.monthsObserved}`,
  ];
  if (p.method === "aucune") {
    return {
      contract,
      readiness: "a_confirmer",
      explanation: "Seul le réalisé à date est disponible : aucune extrapolation n'est produite.",
      details,
    };
  }
  if (p.confidence === "faible") {
    return {
      contract,
      readiness: "partiel",
      explanation: `Projection de confiance faible — ${p.explanation}`,
      details,
    };
  }
  return { contract, readiness: "certifie", explanation: "", details };
}
