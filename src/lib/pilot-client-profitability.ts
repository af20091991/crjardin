// Classification économique des clients (Pilot Pro v2).
//
// Aucune saisie n'est demandée : tout provient du CA (pilot_ca_entries),
// du ledger d'heures consolidé et des interventions. Un client dont les
// données sont insuffisantes n'est PAS classé (confiance = faible).

import type { PilotEntry } from "@/lib/pilot";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import { aggregateHoursByClient } from "@/lib/pilot-hours-ledger";
import { getThresholds, type PilotThresholds } from "@/lib/pilot-thresholds";
import {
  analysisReliability,
  entityEligibility,
  statusOf,
  type EntityStatusMap,
  type Reliability,
} from "@/lib/pilot-entity-rules";
import type { EntityStatus } from "@/lib/pilot-referential";
import { hourlyRate, saleRateEligible } from "@/lib/pilot-sale-time";
import { saleRateRowOf } from "@/lib/pilot";

export type ClientProfitClass =
  | "tres_rentable"
  | "rentable"
  | "a_surveiller"
  | "chronophage"
  | "non_classe";

export const PROFIT_CLASS_META: Record<
  ClientProfitClass,
  { label: string; tone: string; badge: string }
> = {
  tres_rentable: {
    label: "Très rentable",
    tone: "positive",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rentable: { label: "Rentable", tone: "positive", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  a_surveiller: {
    label: "À surveiller",
    tone: "warning",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  chronophage: {
    label: "Chronophage",
    tone: "warning",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
  non_classe: {
    label: "Données insuffisantes",
    tone: "default",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

export interface ClientProfitability {
  clientId: string;
  name: string;
  caTotal: number;
  caYear: number;
  caPrevYear: number;
  /** Évolution CA année vs N-1 en %, `null` si N-1 absent. */
  evolutionPct: number | null;
  hours: number;
  hoursSource: "vente_temps" | "aucune";
  interventions: number;
  /** CA cumulé / heures réelles retenues. */
  tauxHoraire: number | null;
  classe: ClientProfitClass;
  confidence: "haute" | "moyenne" | "faible";
  /** Pourquoi PP affiche ce classement. */
  why: string;
  /** Statut référentiel (règle métier centrale unique). */
  entityStatus: EntityStatus;
  /** L'entité peut-elle apparaître dans un classement stratégique ? */
  rankable: boolean;
  /** Confiance globale du calcul (identité + heures). */
  reliability: Reliability;
}

export function classifyClients(params: {
  entries: PilotEntry[];
  ledger: HoursLedgerEntry[];
  interventionsByClient?: Map<string, number>;
  year: number;
  targetHourlyRate: number;
  thresholds?: PilotThresholds;
  /** Statuts référentiels : obligatoire pour un classement exploitable. */
  statuses?: EntityStatusMap;
}): ClientProfitability[] {
  const t = params.thresholds ?? getThresholds();
  const { entries, ledger, year, targetHourlyRate } = params;

  const agg = new Map<
    string,
    {
      name: string;
      total: number;
      y: number;
      prev: number;
      /** CA des lignes de l'exercice RETENUES (Temps documenté) = numérateur. */
      rated: number;
      linesYear: number;
      /** Temps de ces mêmes lignes retenues = dénominateur. */
      timedHours: number;
    }
  >();
  for (const e of entries) {
    if (!e.client_id) continue;
    const yy = new Date(e.entry_date).getFullYear();
    const cur = agg.get(e.client_id) ?? {
      name: e.client_name ?? "Client",
      total: 0,
      y: 0,
      prev: 0,
      rated: 0,
      linesYear: 0,
      timedHours: 0,
    };
    if (e.client_name) cur.name = e.client_name;
    const amount = Number(e.amount_ht) || 0;
    cur.total += amount;
    // PÉRIMÈTRE UNIQUE : CA et Temps issus des mêmes lignes retenues.
    if (yy === year && saleRateEligible(saleRateRowOf(e))) {
      cur.rated += amount;
      cur.timedHours += Number(e.hours) || 0;
    }
    if (yy === year) {
      cur.y += amount;
      cur.linesYear += 1;
    }
    if (yy === year - 1) cur.prev += amount;
    agg.set(e.client_id, cur);
  }

  // Heures : exclusivement les lignes de vente de l'exercice analysé.
  const hours = aggregateHoursByClient(ledger.filter((l) => l.year === year));
  const rows: ClientProfitability[] = [];

  const ids = new Set<string>([...agg.keys(), ...hours.keys()]);
  for (const clientId of ids) {
    const a = agg.get(clientId);
    const h = hours.get(clientId);
    const caTotal = a?.total ?? 0;
    // CA de l'exercice analysé : seule base économique du classement annuel.
    const caYear = a?.y ?? 0;
    // Heures = Temps des lignes de vente retenues de l'exercice (source unique
    // Chiffre d'affaires → Ventes → Temps). Le registre d'heures ne sert plus
    // qu'à qualifier la source affichée.
    const heures = a?.timedHours ?? 0;
    const source: ClientProfitability["hoursSource"] = heures > 0 ? "vente_temps" : (h?.reellesSource ?? "aucune");
    // Taux horaire = CA des lignes retenues ÷ Temps de ces mêmes lignes.
    const taux = hourlyRate(a?.rated ?? 0, heures);

    const entityStatus = statusOf(params.statuses, clientId);
    const eligibility = entityEligibility(entityStatus);
    const reliability = analysisReliability({
      entityStatus,
      hours: heures,
      hoursSource: source,
      caTotal: caYear,
      minHours: t.heuresMinClient,
    });

    const enough = heures >= t.heuresMinClient && caYear > 0 && targetHourlyRate > 0;
    let classe: ClientProfitClass = "non_classe";
    let why = "Heures ou CA insuffisants pour juger la rentabilité de ce client.";
    if (!eligibility.analytics) {
      // Identité économique non exploitable : aucun classement n'est produit.
      classe = "non_classe";
      why = eligibility.warning ?? "Identité économique à certifier avant tout classement.";
    } else if (enough && taux != null) {
      if (taux >= targetHourlyRate * t.clientTresRentableRatio) {
        classe = "tres_rentable";
        why = `Taux horaire généré ${taux.toFixed(0)} €/h ≥ ${(t.clientTresRentableRatio * 100).toFixed(0)} % de la cible (${targetHourlyRate} €/h) sur ${heures.toFixed(1)} h.`;
      } else if (taux >= targetHourlyRate) {
        classe = "rentable";
        why = `Taux horaire généré ${taux.toFixed(0)} €/h au-dessus de la cible (${targetHourlyRate} €/h).`;
      } else if (taux >= targetHourlyRate * t.clientSurveillerRatio) {
        classe = "a_surveiller";
        why = `Taux horaire généré ${taux.toFixed(0)} €/h légèrement sous la cible (${targetHourlyRate} €/h).`;
      } else {
        classe = "chronophage";
        why = `Taux horaire généré ${taux.toFixed(0)} €/h très en dessous de la cible sur ${heures.toFixed(1)} h consacrées.`;
      }
    }

    const confidence: ClientProfitability["confidence"] = !eligibility.analytics
      ? "faible"
      : source === "vente_temps" && heures >= t.heuresMinClient && eligibility.level === "fiable"
        ? "haute"
        : heures > 0 && caYear > 0
          ? "moyenne"
          : "faible";

    rows.push({
      clientId,
      name: a?.name ?? h?.clientName ?? "Client",
      caTotal,
      caYear,
      caPrevYear: a?.prev ?? 0,
      evolutionPct: a && a.prev > 0 ? ((a.y - a.prev) / a.prev) * 100 : null,
      hours: heures,
      hoursSource: source,
      // Interventions ÉCONOMIQUES = lignes de vente de l'exercice (jamais
      // le nombre de comptes rendus de chantier ni de missions SST).
      interventions: a?.linesYear ?? 0,
      tauxHoraire: taux,
      classe,
      confidence,
      why,
      entityStatus,
      rankable: eligibility.ranking,
      reliability,
    });
  }

  return rows.sort((a, b) => {
    if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
    return b.caYear - a.caYear;
  });
}

/** Classement stratégique : uniquement les entités économiquement exploitables. */
export function strategicClients(rows: ClientProfitability[]): ClientProfitability[] {
  return rows.filter((r) => r.rankable);
}

export function classifyClient(
  clientId: string,
  params: Parameters<typeof classifyClients>[0],
): ClientProfitability | null {
  return classifyClients(params).find((r) => r.clientId === clientId) ?? null;
}
