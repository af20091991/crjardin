// Résolution des heures d'intervention (Pilot Pro — règle structurelle).
//
// RÈGLE MÉTIER ABSOLUE : la seule source de référence des heures
// d'intervention utilisées dans un calcul métier est la colonne
// « Vente → Temps » (pilot_ca_entries.hours des lignes de vente).
//
// Les autres volumes horaires (interventions.hours_spent, import Excel
// pilot_historic_hours, heures estimées ou reconstituées) sont CONSERVÉS pour
// l'historique et la traçabilité, mais n'influencent plus aucun calcul standard.

import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";

export type RealHoursSource =
  | "vente_temps"
  | "aucune";

export const REAL_HOURS_SOURCE_META: Record<
  Exclude<RealHoursSource, "aucune">,
  { label: string; detail: string; confidence: "haute" | "moyenne" }
> = {
  vente_temps: {
    label: "Heures d'intervention (Vente → Temps)",
    detail: "colonne Temps des lignes de vente du suivi CA — source unique de référence",
    confidence: "haute",
  },
};

/** Conservé pour compatibilité : aucun seuil n'est appliqué à Vente → Temps. */
export const MIN_CONFIRMED_HOURS = 0;

export interface RealHoursResolution {
  year: number;
  vendues: number;
  realisees: number;
  historiques: number;
  /** Heures vendues effectivement rattachées à un client (période + client identifiés). */
  venduesIdentifiees: number;
  /**
   * Heures réalisées consolidées : pour chaque client, la meilleure source
   * disponible (interventions confirmées > historique > heures CA identifiées).
   * Aucun double comptage entre sources.
   */
  realiseesConsolidees: number;
  /** Heures retenues comme « réelles » selon la cascade de priorité. */
  hours: number;
  source: RealHoursSource;
  sourceLabel: string;
  sourceDetail: string;
  confidence: "haute" | "moyenne" | "faible";
  ecart: number; // vendues - retenues
  byClient: Map<string, number>;
}

function sumBy(entries: HoursLedgerEntry[], pick: (e: HoursLedgerEntry) => boolean): number {
  return entries.filter(pick).reduce((s, e) => s + e.hours, 0);
}

/**
 * Agrège les heures d'une année. `hours` / `byClient` — les seules valeurs
 * utilisées par les calculs métier — proviennent EXCLUSIVEMENT de Vente → Temps.
 */
export function resolveRealHours(entries: HoursLedgerEntry[], year: number): RealHoursResolution {
  const rows = entries.filter((e) => e.year === year);
  const vendues = sumBy(rows, (e) => e.type === "vendue");
  const realisees = sumBy(rows, (e) => e.type === "realisee" && !e.estimated);
  const historiques = sumBy(rows, (e) => e.type === "historique");
  const venduesIdentifiees = sumBy(rows, (e) => e.type === "vendue" && !!e.clientId);

  // Source unique : Vente → Temps, agrégée par client.
  const byClient = new Map<string, number>();
  for (const e of rows) {
    if (e.type !== "vendue" || !e.clientId || e.hours <= 0) continue;
    byClient.set(e.clientId, (byClient.get(e.clientId) ?? 0) + e.hours);
  }
  const hours = vendues;
  const source: RealHoursSource = hours > 0 ? "vente_temps" : "aucune";

  const meta = source === "aucune" ? null : REAL_HOURS_SOURCE_META[source];
  return {
    year,
    vendues,
    realisees,
    historiques,
    venduesIdentifiees,
    realiseesConsolidees: venduesIdentifiees,
    hours,
    source,
    sourceLabel: meta?.label ?? "Aucune heure d'intervention saisie",
    sourceDetail:
      meta?.detail ?? "aucune heure renseignée dans la colonne Temps des lignes de vente",
    confidence: meta?.confidence ?? "faible",
    ecart: vendues - hours,
    byClient,
  };
}

export interface InterventionHoursInput {
  id: string;
  client_id: string | null;
  intervention_date: string;
  status: string;
  hours_spent?: number | null;
  ai_metadata?: unknown;
}

/**
 * Les heures d'intervention proviennent désormais exclusivement de
 * Vente → Temps : `interventions.hours_spent` n'alimente plus aucun calcul,
 * donc plus aucune saisie n'est réclamée. Conservé pour compatibilité d'appel.
 */
export function interventionsNeedingHours(
  _interventions: InterventionHoursInput[],
  _ledger: HoursLedgerEntry[],
  _year: number,
): InterventionHoursInput[] {
  return [];
}