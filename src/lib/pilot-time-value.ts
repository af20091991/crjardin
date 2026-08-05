// -----------------------------------------------------------------------------
// Analyse Temps & Rentabilité (Pilot Pro V2.3+)
//
// COUCHE D'ANALYSE PURE : ce module ne lit aucune table directement, ne crée
// aucune donnée et ne modifie aucun calcul existant. Il croise les objets déjà
// produits par les moteurs en place :
//   - PilotEntry[]        (CA normalisé : pilot_ca_entries, kind = 'vente')
//   - HoursLedgerEntry[]  (ledger d'heures unique : interventions / historique / vendues)
//   - ChargeRow[]         (charges validées : pilot_ca_entries, kind = 'charge')
//
// Hiérarchie des heures respectée telle quelle :
//   1. heures réalisées confirmées (interventions.hours_spent, non estimées)
//   2. heures historiques validées (pilot_historic_hours)
//   3. heures vendues (CA) — uniquement en dernier recours, signalé
// Les heures estimées sont exclues, jamais mélangées aux heures réalisées.
// -----------------------------------------------------------------------------

import type { PilotEntry } from "@/lib/pilot";
import { canonicalPrestation } from "@/lib/pilot-ca-designation";
import { operatingCharges, type ChargeRow } from "@/lib/pilot-charges";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import { normalizePrestation } from "@/lib/pilot-service-profitability";

export type HoursBasis = "reelles" | "historique" | "vendues" | "aucune";

export const HOURS_BASIS_LABEL: Record<HoursBasis, string> = {
  reelles: "Heures réalisées confirmées (interventions)",
  historique: "Heures historiques validées (import Excel)",
  vendues: "Heures vendues (lignes CA) — analyse indicative",
  aucune: "Aucune heure connue",
};

export interface TimeValueFilters {
  /** Exercice, ou `all` pour cumuler tous les exercices présents. */
  year: number | "all";
  /** Mois de début / fin (1-12), bornes incluses. */
  monthFrom: number;
  monthTo: number;
  /** Prestation canonique (SAP, AP, Conseil…) ou `all`. */
  prestation: string;
  /** Identifiant client ou `all`. */
  clientId: string;
}

export const DEFAULT_TIME_VALUE_FILTERS: TimeValueFilters = {
  year: "all",
  monthFrom: 1,
  monthTo: 12,
  prestation: "all",
  clientId: "all",
};

function monthOf(iso: string): number {
  return new Date(iso).getMonth() + 1;
}
function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

function inScopeYearMonth(f: TimeValueFilters, year: number, month: number | null): boolean {
  if (f.year !== "all" && year !== f.year) return false;
  if (month == null) return f.monthFrom === 1 && f.monthTo === 12;
  return month >= f.monthFrom && month <= f.monthTo;
}

/** Prestation canonique d'une ligne CA (désignation + catégorie). */
export function entryPrestation(e: PilotEntry): string {
  return canonicalPrestation(e.client_name, e.nature);
}

// ---------------------------------------------------------------------------
// Coût horaire d'exploitation (allocation explicite, jamais inventée)
// ---------------------------------------------------------------------------

export interface CostBasis {
  /** Charges d'exploitation validées de la période (hors investissements). */
  chargesTotal: number;
  /** Montant de charges encore « à classer » : le résultat est donc un minimum. */
  chargesUnclassified: number;
  /** Heures retenues au total (base de répartition). */
  hoursTotal: number;
  /** chargesTotal / hoursTotal, `null` si non calculable. */
  costPerHour: number | null;
}

/**
 * Les charges ne sont pas rattachées à un client ni à une prestation en base.
 * Elles sont donc réparties **au prorata des heures retenues** — méthode
 * affichée à l'écran. Aucune charge n'est créée ni ventilée en base.
 */
export function buildCostBasis(
  chargeRows: ChargeRow[],
  filters: TimeValueFilters,
  hoursTotal: number,
): CostBasis {
  const scoped = operatingCharges(chargeRows).filter(
    (c) => !c.is_investment && inScopeYearMonth(filters, c.year, c.month),
  );
  const chargesTotal = scoped.reduce((s, c) => s + (Number(c.amount_ht) || 0), 0);
  const chargesUnclassified = scoped
    .filter((c) => c.charge_class === "a_classer")
    .reduce((s, c) => s + (Number(c.amount_ht) || 0), 0);
  return {
    chargesTotal,
    chargesUnclassified,
    hoursTotal,
    costPerHour: hoursTotal > 0 && chargesTotal > 0 ? chargesTotal / hoursTotal : null,
  };
}

// ---------------------------------------------------------------------------
// PARTIE 1 — Analyse par type de prestation
// ---------------------------------------------------------------------------

export interface PrestationTimeValue {
  prestation: string;
  caHt: number;
  /** Heures retenues selon la hiérarchie (réelles > historique > vendues). */
  hours: number;
  hoursBasis: HoursBasis;
  hoursRealisees: number;
  hoursHistoriques: number;
  hoursVendues: number;
  /** Part des heures de cette prestation dans le total de la période. */
  hoursPct: number;
  /** Charges réparties au prorata des heures (null si non calculable). */
  charges: number | null;
  /** CA HT − charges réparties (null si charges non calculables). */
  resultatBrut: number | null;
  /** CA HT / heures retenues. */
  caPerHour: number | null;
  /** Résultat brut / heures retenues. */
  resultPerHour: number | null;
  lignes: number;
  clients: number;
}

interface HoursBuckets {
  realisees: number;
  historiques: number;
  vendues: number;
}

/**
 * Source unique des heures d'intervention : Vente → Temps (bucket `vendues`).
 * Les heures comptes-rendus / historiques restent exposées à titre informatif.
 */
function pickHours(b: HoursBuckets): { hours: number; basis: HoursBasis } {
  if (b.vendues > 0) return { hours: b.vendues, basis: "vendues" };
  return { hours: 0, basis: "aucune" };
}

function emptyBuckets(): HoursBuckets {
  return { realisees: 0, historiques: 0, vendues: 0 };
}

function addLedger(map: Map<string, HoursBuckets>, key: string, e: HoursLedgerEntry) {
  const cur = map.get(key) ?? emptyBuckets();
  if (e.type === "realisee") {
    if (!e.estimated) cur.realisees += e.hours;
  } else if (e.type === "historique") cur.historiques += e.hours;
  else cur.vendues += e.hours;
  map.set(key, cur);
}

export interface TimeValueAnalysis {
  prestations: PrestationTimeValue[];
  clients: ClientTimeValue[];
  cost: CostBasis;
  /** Heures totales retenues sur la période analysée. */
  hoursTotal: number;
  caTotal: number;
  /** Signalements de qualité de données à afficher tel quel. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// PARTIE 2/3/4 — Analyse par client, zones stratégiques, classement
// ---------------------------------------------------------------------------

export type ClientZone = "strategique" | "a_developper" | "a_optimiser" | "chronophage" | "non_classe";

export const CLIENT_ZONE_META: Record<ClientZone, { label: string; badge: string; hint: string }> = {
  strategique: {
    label: "Client stratégique",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    hint: "Peu d'heures consommées, forte rentabilité horaire.",
  },
  a_developper: {
    label: "Client à développer",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    hint: "Peu de temps consommé, rentabilité horaire encore sous la cible : potentiel.",
  },
  a_optimiser: {
    label: "Client à optimiser",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    hint: "Beaucoup de temps consommé pour une rentabilité proche de la cible.",
  },
  chronophage: {
    label: "Client chronophage",
    badge: "border-red-200 bg-red-50 text-red-700",
    hint: "Beaucoup de temps consommé pour une rentabilité insuffisante.",
  },
  non_classe: {
    label: "Données insuffisantes",
    badge: "border-border bg-muted text-muted-foreground",
    hint: "Heures ou CA manquants : ce client n'est pas classé.",
  },
};

export interface ClientTimeValue {
  clientId: string;
  name: string;
  caHt: number;
  hours: number;
  hoursBasis: HoursBasis;
  interventions: number;
  charges: number | null;
  resultatBrut: number | null;
  caPerHour: number | null;
  resultPerHour: number | null;
  mainPrestation: string | null;
  zone: ClientZone;
  /** Rang de rentabilité (1 = meilleur €/h), null si non classé. */
  rank: number | null;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function analyzeTimeValue(params: {
  entries: PilotEntry[];
  ledger: HoursLedgerEntry[];
  chargeRows: ChargeRow[];
  interventionsByClient?: Map<string, number>;
  clientNames?: Map<string, string>;
  filters: TimeValueFilters;
  /** Cible de rentabilité horaire issue des règles de calcul existantes. */
  targetHourlyRate: number;
}): TimeValueAnalysis {
  const { entries, ledger, chargeRows, filters, targetHourlyRate } = params;

  // --- CA de la période ---------------------------------------------------
  const scopedEntries = entries.filter((e) => {
    const y = yearOf(e.entry_date);
    const m = monthOf(e.entry_date);
    if (!inScopeYearMonth(filters, y, m)) return false;
    if (filters.prestation !== "all" && entryPrestation(e) !== filters.prestation) return false;
    if (filters.clientId !== "all" && e.client_id !== filters.clientId) return false;
    return true;
  });

  // --- Heures de la période ----------------------------------------------
  const scopedLedger = ledger.filter((l) => {
    if (!inScopeYearMonth(filters, l.year, l.month)) return false;
    if (filters.prestation !== "all" && normalizePrestation(l.prestation) !== filters.prestation) return false;
    if (filters.clientId !== "all" && l.clientId !== filters.clientId) return false;
    return true;
  });

  // Heures par prestation
  const prestHours = new Map<string, HoursBuckets>();
  for (const l of scopedLedger) addLedger(prestHours, normalizePrestation(l.prestation), l);

  // CA par prestation
  const prestCa = new Map<
    string,
    { ca: number; lignes: number; clients: Set<string>; hoursVenduesCa: number }
  >();
  for (const e of scopedEntries) {
    const key = entryPrestation(e);
    const cur = prestCa.get(key) ?? { ca: 0, lignes: 0, clients: new Set<string>(), hoursVenduesCa: 0 };
    cur.ca += Number(e.amount_ht) || 0;
    cur.lignes += 1;
    cur.hoursVenduesCa += Number(e.hours) || 0;
    if (e.client_id) cur.clients.add(e.client_id);
    prestCa.set(key, cur);
  }

  const prestKeys = new Set<string>([...prestHours.keys(), ...prestCa.keys()]);
  const prestPicked = new Map<string, { hours: number; basis: HoursBasis; b: HoursBuckets }>();
  for (const key of prestKeys) {
    const b = prestHours.get(key) ?? emptyBuckets();
    if (b.vendues === 0) b.vendues = prestCa.get(key)?.hoursVenduesCa ?? 0;
    prestPicked.set(key, { ...pickHours(b), b });
  }
  const hoursTotal = [...prestPicked.values()].reduce((s, v) => s + v.hours, 0);

  const cost = buildCostBasis(chargeRows, filters, hoursTotal);

  const prestations: PrestationTimeValue[] = [...prestKeys]
    .map((prestation) => {
      const picked = prestPicked.get(prestation)!;
      const ca = prestCa.get(prestation);
      const caHt = ca?.ca ?? 0;
      const charges = cost.costPerHour != null ? cost.costPerHour * picked.hours : null;
      const resultat = charges != null ? caHt - charges : null;
      return {
        prestation,
        caHt,
        hours: picked.hours,
        hoursBasis: picked.basis,
        hoursRealisees: picked.b.realisees,
        hoursHistoriques: picked.b.historiques,
        hoursVendues: picked.b.vendues,
        hoursPct: hoursTotal > 0 ? (picked.hours / hoursTotal) * 100 : 0,
        charges,
        resultatBrut: resultat,
        caPerHour: picked.hours > 0 && caHt > 0 ? caHt / picked.hours : null,
        resultPerHour: resultat != null && picked.hours > 0 ? resultat / picked.hours : null,
        lignes: ca?.lignes ?? 0,
        clients: ca?.clients.size ?? 0,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  // --- Clients ------------------------------------------------------------
  const clientHours = new Map<string, HoursBuckets>();
  for (const l of scopedLedger) {
    if (!l.clientId) continue;
    addLedger(clientHours, l.clientId, l);
  }

  const clientCa = new Map<
    string,
    { ca: number; name: string; prest: Map<string, number>; hoursVenduesCa: number }
  >();
  for (const e of scopedEntries) {
    if (!e.client_id) continue;
    const cur =
      clientCa.get(e.client_id) ??
      {
        ca: 0,
        name: params.clientNames?.get(e.client_id) ?? "Client",
        prest: new Map<string, number>(),
        hoursVenduesCa: 0,
      };
    const amount = Number(e.amount_ht) || 0;
    cur.ca += amount;
    cur.hoursVenduesCa += Number(e.hours) || 0;
    const p = entryPrestation(e);
    cur.prest.set(p, (cur.prest.get(p) ?? 0) + amount);
    clientCa.set(e.client_id, cur);
  }

  const ids = new Set<string>([...clientHours.keys(), ...clientCa.keys()]);
  const rows: ClientTimeValue[] = [];
  for (const clientId of ids) {
    const ca = clientCa.get(clientId);
    const b = clientHours.get(clientId) ?? emptyBuckets();
    if (b.vendues === 0) b.vendues = ca?.hoursVenduesCa ?? 0;
    const { hours, basis } = pickHours(b);
    const caHt = ca?.ca ?? 0;
    const charges = cost.costPerHour != null ? cost.costPerHour * hours : null;
    const resultat = charges != null ? caHt - charges : null;
    const mainPrestation =
      ca && ca.prest.size ? [...ca.prest.entries()].sort((x, y) => y[1] - x[1])[0][0] : null;
    rows.push({
      clientId,
      name:
        params.clientNames?.get(clientId) ??
        ca?.name ??
        scopedLedger.find((l) => l.clientId === clientId)?.clientName ??
        "Client",
      caHt,
      hours,
      hoursBasis: basis,
      interventions: params.interventionsByClient?.get(clientId) ?? 0,
      charges,
      resultatBrut: resultat,
      caPerHour: hours > 0 && caHt > 0 ? caHt / hours : null,
      resultPerHour: resultat != null && hours > 0 ? resultat / hours : null,
      mainPrestation,
      zone: "non_classe",
      rank: null,
    });
  }

  // Zones : médiane des heures pour l'axe temps, cible horaire pour l'axe valeur.
  const classifiable = rows.filter((r) => r.hours > 0 && r.caHt > 0);
  const medHours = median(classifiable.map((r) => r.hours));
  for (const r of rows) {
    if (r.hours <= 0 || r.caHt <= 0) continue;
    const perHour = r.resultPerHour ?? r.caPerHour;
    if (perHour == null || targetHourlyRate <= 0) continue;
    const lowTime = r.hours <= medHours;
    const good = perHour >= targetHourlyRate;
    r.zone = lowTime ? (good ? "strategique" : "a_developper") : good ? "a_optimiser" : "chronophage";
  }

  // Rang de rentabilité (meilleur €/h = 1), uniquement sur les clients classés.
  const ranked = rows
    .filter((r) => r.zone !== "non_classe")
    .sort((a, b) => (b.resultPerHour ?? b.caPerHour ?? 0) - (a.resultPerHour ?? a.caPerHour ?? 0));
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  // --- Signalements qualité ---------------------------------------------
  const warnings: string[] = [];
  const noHours = rows.filter((r) => r.hours <= 0).length;
  const indicative = rows.filter((r) => r.hoursBasis === "vendues").length;
  if (noHours > 0) {
    warnings.push(
      `Heures réelles incomplètes : ${noHours} client(s) sans aucune heure connue — exclus du classement.`,
    );
  }
  if (indicative > 0) {
    warnings.push(
      `Analyse indicative pour ${indicative} client(s) : seules des heures vendues sont disponibles (pas d'heures réalisées ni historiques).`,
    );
  }
  if (cost.chargesUnclassified > 0) {
    warnings.push(
      `Charges partiellement classées (${Math.round(cost.chargesUnclassified)} € à classer) : le résultat brut affiché est un minimum.`,
    );
  }
  if (cost.costPerHour == null) {
    warnings.push(
      "Aucune charge exploitable sur la période : seul le CA par heure est affiché, pas de résultat brut.",
    );
  }
  warnings.push("Site non qualifié : analyse conduite au niveau Client (modèle Client / Site inchangé).");

  return {
    prestations,
    clients: rows.sort((a, b) => b.caHt - a.caHt),
    cost,
    hoursTotal,
    caTotal: scopedEntries.reduce((s, e) => s + (Number(e.amount_ht) || 0), 0),
    warnings,
  };
}

export type PrestationSort = "euro_h" | "hours" | "ca";
export type ClientSort = "best_euro_h" | "worst_euro_h" | "ca" | "hours";

export function sortPrestations(rows: PrestationTimeValue[], sort: PrestationSort): PrestationTimeValue[] {
  const out = [...rows];
  if (sort === "hours") return out.sort((a, b) => b.hours - a.hours);
  if (sort === "ca") return out.sort((a, b) => b.caHt - a.caHt);
  return out.sort(
    (a, b) => (b.resultPerHour ?? b.caPerHour ?? -Infinity) - (a.resultPerHour ?? a.caPerHour ?? -Infinity),
  );
}

export function sortClients(rows: ClientTimeValue[], sort: ClientSort): ClientTimeValue[] {
  const out = [...rows];
  const perHour = (r: ClientTimeValue) => r.resultPerHour ?? r.caPerHour;
  if (sort === "ca") return out.sort((a, b) => b.caHt - a.caHt);
  if (sort === "hours") return out.sort((a, b) => b.hours - a.hours);
  if (sort === "worst_euro_h")
    return out.sort((a, b) => (perHour(a) ?? Infinity) - (perHour(b) ?? Infinity));
  return out.sort((a, b) => (perHour(b) ?? -Infinity) - (perHour(a) ?? -Infinity));
}
