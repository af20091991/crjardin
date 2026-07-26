// Résolution des heures réelles exploitables (Pilot Pro v2).
//
// Règle fondamentale : ne jamais demander une saisie lorsque l'information
// existe déjà dans Pilot Pro. Une intervention terminée sans heures saisies
// n'est une tâche utilisateur QUE si aucune autre source PP ne couvre la
// période/le client concerné.
//
// Priorité des heures réelles :
//   1. interventions.hours_spent confirmées (non estimées)
//   2. heures historiques Excel validées et rattachées
//   3. heures présentes dans le ledger (heures vendues du suivi CA)
//   4. aucune — jamais d'estimation, jamais de donnée inventée

import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";

export type RealHoursSource = "interventions" | "historique" | "ledger_vendu" | "aucune";

export const REAL_HOURS_SOURCE_META: Record<
  Exclude<RealHoursSource, "aucune">,
  { label: string; detail: string; confidence: "haute" | "moyenne" }
> = {
  interventions: {
    label: "Heures réalisées confirmées",
    detail: "interventions terminées avec heures confirmées",
    confidence: "haute",
  },
  historique: {
    label: "Heures historiques validées",
    detail: "import Excel rattaché au référentiel client",
    confidence: "haute",
  },
  ledger_vendu: {
    label: "Heures vendues (ledger CA)",
    detail: "heures portées par les lignes de vente du suivi CA",
    confidence: "moyenne",
  },
};

/** Volume minimal d'heures confirmées pour retenir la source interventions. */
export const MIN_CONFIRMED_HOURS = 20;

export interface RealHoursResolution {
  year: number;
  vendues: number;
  realisees: number;
  historiques: number;
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

/** Agrège les heures réelles exploitables d'une année, toutes sources PP. */
export function resolveRealHours(entries: HoursLedgerEntry[], year: number): RealHoursResolution {
  const rows = entries.filter((e) => e.year === year);
  const vendues = sumBy(rows, (e) => e.type === "vendue");
  const realisees = sumBy(rows, (e) => e.type === "realisee" && !e.estimated);
  const historiques = sumBy(rows, (e) => e.type === "historique");

  let source: RealHoursSource = "aucune";
  if (realisees >= MIN_CONFIRMED_HOURS) source = "interventions";
  else if (historiques > 0) source = "historique";
  else if (realisees > 0) source = "interventions";
  else if (vendues > 0) source = "ledger_vendu";

  const hours =
    source === "interventions" ? realisees : source === "historique" ? historiques : source === "ledger_vendu" ? vendues : 0;

  const byClient = new Map<string, number>();
  if (source !== "aucune") {
    const type = source === "interventions" ? "realisee" : source === "historique" ? "historique" : "vendue";
    for (const e of rows) {
      if (e.type !== type || !e.clientId) continue;
      if (e.type === "realisee" && e.estimated) continue;
      byClient.set(e.clientId, (byClient.get(e.clientId) ?? 0) + e.hours);
    }
  }

  const meta = source === "aucune" ? null : REAL_HOURS_SOURCE_META[source];
  return {
    year,
    vendues,
    realisees,
    historiques,
    hours,
    source,
    sourceLabel: meta?.label ?? "Aucune heure réelle disponible",
    sourceDetail: meta?.detail ?? "aucune source d'heures exploitable dans Pilot Pro",
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
  ai_metadata: unknown;
}

/**
 * Interventions terminées dont les heures n'existent NULLE PART dans PP.
 * Une intervention dont le client dispose déjà d'heures (ledger CA, historique,
 * autre intervention confirmée) sur la même année n'est pas une tâche de saisie :
 * l'information est déjà présente et exploitée par le moteur d'analyse.
 */
export function interventionsNeedingHours(
  interventions: InterventionHoursInput[],
  ledger: HoursLedgerEntry[],
  year: number,
): InterventionHoursInput[] {
  const covered = new Set<string>();
  for (const e of ledger) {
    if (e.year !== year || !e.clientId || e.hours <= 0) continue;
    if (e.type === "realisee" && e.estimated) continue;
    covered.add(e.clientId);
  }
  return interventions.filter((i) => {
    if (i.status !== "terminee") return false;
    if (Number(i.intervention_date.slice(0, 4)) !== year) return false;
    const meta = i.ai_metadata && typeof i.ai_metadata === "object" ? (i.ai_metadata as Record<string, unknown>) : null;
    const estimated = Boolean(meta?.["hours_estimated"] || meta?.["hours_spent_estimated"]);
    const h = Number(i.hours_spent) || 0;
    const missing = h <= 0 || estimated;
    if (!missing) return false;
    return !(i.client_id && covered.has(i.client_id));
  });
}