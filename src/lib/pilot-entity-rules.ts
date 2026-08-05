// ---------------------------------------------------------------------------
// RÈGLE MÉTIER CENTRALE UNIQUE — exploitabilité analytique d'une entité.
//
// Chantier « Normalisation du référentiel économique ». Tous les modules
// analytiques (classement, rentabilité, portefeuille, scores, opportunités,
// dashboard, conseiller) DOIVENT passer par ce module. Aucun module ne
// recrée sa propre logique de confiance.
//
// Distinction sanctuarisée :
//   - Entité économique cliente : porte le CA, seule base des analyses.
//   - Contact / interlocuteur    : personne physique, jamais une entité.
//   - Site / chantier            : lieu d'intervention, jamais une entité.
//   - Prestation                 : nature de la vente.
//   - Source de données          : CA / heures / interventions / Excel / CEEV / SST.
//
// Ce module est en LECTURE SEULE : aucune fusion, aucun déplacement de CA,
// aucune écriture. Les corrections passent par pilot-referential.ts
// (validation humaine + referential_audit_log).
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityStatus } from "@/lib/pilot-referential";

export type EntityUsage = "analyses" | "avec_avertissement" | "exclu";

export interface EntityEligibility {
  status: EntityStatus;
  /** Peut alimenter les analyses stratégiques. */
  analytics: boolean;
  /** Peut apparaître dans un classement / TOP / portefeuille stratégique. */
  ranking: boolean;
  usage: EntityUsage;
  /** Niveau de confiance sur l'identité économique. */
  level: "fiable" | "a_confirmer" | "non_fiable";
  label: string;
  /** Message affichable à l'écran (null si aucune réserve). */
  warning: string | null;
}

const RULES: Record<EntityStatus, Omit<EntityEligibility, "status">> = {
  certified_client: {
    analytics: true,
    ranking: true,
    usage: "analyses",
    level: "fiable",
    label: "Entité économique certifiée",
    warning: null,
  },
  probable_client: {
    analytics: true,
    ranking: true,
    usage: "avec_avertissement",
    level: "a_confirmer",
    label: "Entité économique probable",
    warning: "Identité économique non certifiée — indicateurs à confirmer.",
  },
  probable_contact: {
    analytics: false,
    ranking: false,
    usage: "exclu",
    level: "non_fiable",
    label: "Contact / interlocuteur",
    warning:
      "Cette fiche est un contact (personne physique) : elle ne peut pas être considérée comme une entité économique cliente.",
  },
  duplicate_candidate: {
    analytics: false,
    ranking: false,
    usage: "exclu",
    level: "non_fiable",
    label: "Doublon économique possible",
    warning:
      "Doublon économique possible : cette fiche ne peut pas alimenter un classement fiable.",
  },
  manual_review_required: {
    analytics: false,
    ranking: false,
    usage: "avec_avertissement",
    level: "a_confirmer",
    label: "À examiner",
    warning:
      "Statut référentiel non examiné : données limitées, à valider dans le centre de contrôle.",
  },
};

export function normalizeEntityStatus(status: string | null | undefined): EntityStatus {
  return (status && status in RULES ? status : "manual_review_required") as EntityStatus;
}

/** Règle unique : que peut-on faire d'une entité selon son statut référentiel ? */
export function entityEligibility(status: string | null | undefined): EntityEligibility {
  const s = normalizeEntityStatus(status);
  return { status: s, ...RULES[s] };
}

/** Une entité peut-elle alimenter les analyses stratégiques ? */
export function canFeedAnalytics(status: string | null | undefined): boolean {
  return entityEligibility(status).analytics;
}

/** Une entité peut-elle apparaître dans un classement stratégique ? */
export function canRank(status: string | null | undefined): boolean {
  return entityEligibility(status).ranking;
}

// ---------------------------------------------------------------------------
// Sources d'heures — séparation stricte (jamais de mélange)
// ---------------------------------------------------------------------------

export type HoursSourceKey =
  | "vente_temps"
  | "interventions"
  | "historique"
  | "ca"
  | "aucune";

export const HOURS_SOURCE_META: Record<
  HoursSourceKey,
  { label: string; short: string; reliable: boolean }
> = {
  vente_temps: {
    label: "Heures d'intervention (Vente → Temps)",
    short: "Vente → Temps",
    reliable: true,
  },
  interventions: {
    label: "Heures comptes-rendus (historique, hors calculs)",
    short: "comptes-rendus",
    reliable: false,
  },
  historique: {
    label: "Heures historiques import Excel (hors calculs)",
    short: "historique Excel",
    reliable: false,
  },
  ca: {
    label: "Heures d'intervention (Vente → Temps)",
    short: "Vente → Temps",
    reliable: true,
  },
  aucune: { label: "Aucune heure connue", short: "aucune source", reliable: false },
};

// ---------------------------------------------------------------------------
// Fiabilité d'une analyse de rentabilité (identité + couverture horaire)
// ---------------------------------------------------------------------------

export interface ReliabilityInput {
  entityStatus: string | null | undefined;
  /** Heures retenues pour le calcul. */
  hours: number;
  hoursSource: HoursSourceKey;
  caTotal: number;
  /** Seuil d'heures minimal (Paramètres PP). */
  minHours?: number;
}

export interface Reliability {
  level: "fiable" | "provisoire" | "non_fiable";
  label: string;
  /** Motifs cumulés, affichables tels quels. */
  reasons: string[];
  /** La rentabilité peut-elle être présentée comme un fait ? */
  profitabilityTrusted: boolean;
  entity: EntityEligibility;
  hoursSourceLabel: string;
}

/**
 * Une rentabilité n'est jamais fiable si l'identité est incertaine ou si la
 * couverture horaire est insuffisante. CA élevé + peu d'heures ≠ client
 * exceptionnellement rentable.
 */
export function analysisReliability(input: ReliabilityInput): Reliability {
  const entity = entityEligibility(input.entityStatus);
  const minHours = input.minHours ?? 4;
  const reasons: string[] = [];

  if (entity.warning) reasons.push(entity.warning);
  if (input.hours <= 0) reasons.push("Aucune heure disponible sur la période.");
  else if (input.hours < minHours)
    reasons.push(
      `Couverture horaire insuffisante (${input.hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h < ${minHours} h).`,
    );
  if (input.hours > 0 && !HOURS_SOURCE_META[input.hoursSource].reliable)
    reasons.push(
      "Heures issues d'une source historique : seule la colonne Vente → Temps alimente les calculs.",
    );
  if (input.caTotal <= 0) reasons.push("Aucun chiffre d'affaires rattaché.");

  const hoursOk =
    input.hours >= minHours && HOURS_SOURCE_META[input.hoursSource].reliable && input.caTotal > 0;

  let level: Reliability["level"];
  if (!entity.analytics) level = entity.level === "non_fiable" ? "non_fiable" : "provisoire";
  else level = hoursOk ? (entity.level === "fiable" ? "fiable" : "provisoire") : "provisoire";

  const label =
    level === "fiable"
      ? "Rentabilité fiable"
      : level === "provisoire"
        ? hoursOk
          ? "Rentabilité provisoire — identité économique à certifier"
          : "Rentabilité provisoire — couverture horaire insuffisante"
        : "Rentabilité non exploitable — identité économique non fiable";

  return {
    level,
    label,
    reasons,
    profitabilityTrusted: level === "fiable",
    entity,
    hoursSourceLabel: HOURS_SOURCE_META[input.hoursSource].label,
  };
}

// ---------------------------------------------------------------------------
// Chargement des statuts référentiels (source unique : clients.entity_status)
// ---------------------------------------------------------------------------

export type EntityStatusMap = Map<string, EntityStatus>;

export async function fetchEntityStatuses(): Promise<EntityStatusMap> {
  const { data, error } = await supabase.from("clients").select("id,entity_status");
  if (error) throw error;
  const map: EntityStatusMap = new Map();
  for (const row of (data ?? []) as Array<{ id: string; entity_status: string | null }>) {
    map.set(row.id, normalizeEntityStatus(row.entity_status));
  }
  return map;
}

export const ENTITY_STATUSES_QUERY_KEY = ["entity-statuses"] as const;

/** Hook partagé : un seul chargement des statuts pour toute l'application. */
export function useEntityStatuses() {
  return useQuery({
    queryKey: ENTITY_STATUSES_QUERY_KEY,
    queryFn: fetchEntityStatuses,
    staleTime: 60_000,
  });
}

/** Statut d'une fiche depuis la carte partagée (défaut : à examiner). */
export function statusOf(map: EntityStatusMap | undefined, clientId: string | null | undefined): EntityStatus {
  if (!clientId) return "manual_review_required";
  return map?.get(clientId) ?? "manual_review_required";
}

export interface ReferentialCoverage {
  total: number;
  exploitable: number;
  toValidate: number;
  excluded: number;
  caExploitable: number;
  caExcluded: number;
}

/** Synthèse d'exploitabilité d'un ensemble de lignes analytiques. */
export function referentialCoverage(
  rows: Array<{ entityStatus: string | null | undefined; caTotal: number }>,
): ReferentialCoverage {
  const out: ReferentialCoverage = {
    total: rows.length,
    exploitable: 0,
    toValidate: 0,
    excluded: 0,
    caExploitable: 0,
    caExcluded: 0,
  };
  for (const r of rows) {
    const e = entityEligibility(r.entityStatus);
    const ca = Number(r.caTotal) || 0;
    if (e.status === "certified_client") {
      out.exploitable += 1;
      out.caExploitable += ca;
    } else if (e.analytics || e.usage === "avec_avertissement") {
      out.toValidate += 1;
      if (e.analytics) out.caExploitable += ca;
      else out.caExcluded += ca;
    } else {
      out.excluded += 1;
      out.caExcluded += ca;
    }
  }
  return out;
}
