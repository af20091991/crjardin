// Jeux de données MINIMAUX, uniquement en mémoire, pour les tests métier.
// Aucune donnée réelle, aucune connexion Supabase, aucune dépendance à l'heure
// système : toutes les dates sont explicites et situées dans le passé.
import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import type { EngineInputs, EngineScope } from "@/lib/pilot-engine";
import type { EntityStatusMap } from "@/lib/pilot-entity-rules";
import { DEFAULT_SETTINGS } from "@/lib/pilot";

/** Date de référence figée pour tous les tests (mode réel = date ≤ NOW). */
export const NOW = new Date("2024-08-15T12:00:00Z");
export const YEAR = 2024;

export function sale(over: Partial<PilotEntry> & { id: string; entry_date: string }): PilotEntry {
  const amount = over.amount_ht ?? 0;
  const hoursRaw = over.hours_raw ?? over.hours ?? null;
  return {
    user_id: "u1",
    client_id: null,
    client_name: null,
    family: "sap",
    nature: null,
    amount_ht: amount,
    amount_ttc: amount,
    hours: over.hours ?? 0,
    hours_raw: hoursRaw,
    intervention_type: null,
    amount_ht_raw: over.amount_ht_raw ?? amount,
    hours_input: over.hours_input ?? hoursRaw,
    observation: null,
    sale_status: "regle",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...over,
  };
}

export function charge(
  over: Partial<ChargeRow> & { id: string; year: number; month: number },
): ChargeRow {
  return {
    designation: "Charge test",
    amount_ht: 0,
    charge_class: "fixe",
    charge_category: "Divers",
    kind: "charge",
    is_investment: false,
    ...over,
  };
}

export function ledgerSale(
  over: Partial<HoursLedgerEntry> & { id: string; year: number; hours: number },
): HoursLedgerEntry {
  return {
    type: "vendue",
    source: "pilot_ca_entries",
    clientId: null,
    clientName: null,
    rawLabel: null,
    month: 3,
    prestation: null,
    confidence: "haute",
    estimated: false,
    ...over,
  };
}

export function statuses(map: Record<string, string>): EntityStatusMap {
  return new Map(Object.entries(map)) as EntityStatusMap;
}

export function scope(over: Partial<EngineScope> = {}): EngineScope {
  return { year: YEAR, mode: "reel", strict: false, ...over };
}

/** Entrées du moteur : tout est vide par défaut, chaque test remplit le minimum. */
export function engineInputs(over: Partial<EngineInputs> = {}): EngineInputs {
  return {
    scope: scope(),
    entries: [],
    chargeRows: [],
    ledger: [],
    scores: [],
    statuses: new Map() as EntityStatusMap,
    salesByYear: new Map<number, number>(),
    settings: { user_id: "u1", ...DEFAULT_SETTINGS },
    hoursRows: [],
    monthlyCa: new Array(12).fill(0),
    monthlyFieldHours: new Array(12).fill(0),
    tjmSettings: null,
    chargeCategories: [],
    prevConfirmedHours: new Map<string, number>(),
    ...over,
  };
}
