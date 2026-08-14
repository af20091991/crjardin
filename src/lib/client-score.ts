import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/pilot";
import { daysBetween as _daysBetween, currentYear as _currentYear } from "@/lib/date-utils";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
// Règle métier centrale UNIQUE (aucune logique de confiance recréée ici).
import { entityEligibility } from "@/lib/pilot-entity-rules";
import { hourlyRate, saleRateEligible, type SaleRateRow } from "@/lib/pilot-sale-time";

// ---------- Règles de classement (ajustables) ----------
export const SCORE_RULES = {
  STRATEGIC: {
    minRateRatio: 0.95,
    minRevenueYear: 2000,
    maxInactivityDays: CLIENT_ACTIVITY_RULES.WARNING_DAYS,
  },
  TO_OPTIMIZE: {
    minRateRatio: 0.75,
  },
  LOW_PROFITABILITY: {
    maxRateRatio: 0.75,
    inactivityDays: CLIENT_ACTIVITY_RULES.DORMANT_DAYS,
  },
  DATA_INSUFFICIENT: {
    minRevenue: 500,
    minConfirmedHoursRatio: 0.5,
  },
} as const;

export const CONFIDENCE_RULES = {
  HIGH: {
    minInterventions: 5,
    minConfirmedHoursRatio: 0.8,
  },
  MEDIUM: {
    minInterventions: 2,
    minConfirmedHoursRatio: 0.5,
  },
} as const;

export type ClientScoreLabel =
  | "strategique"
  | "a_optimiser"
  | "peu_rentable"
  | "donnees_insuffisantes";

export const SCORE_META: Record<
  ClientScoreLabel,
  { label: string; emoji: string; color: string }
> = {
  strategique: { label: "Client stratégique", emoji: "🟢", color: "#4F8E33" },
  a_optimiser: { label: "Client à optimiser", emoji: "🟠", color: "#EE8627" },
  peu_rentable: { label: "Client peu rentable", emoji: "🔴", color: "#C0392B" },
  donnees_insuffisantes: {
    label: "Données insuffisantes",
    emoji: "⚪",
    color: "#8896A0",
  },
};

export interface ClientScore {
  client_id: string;
  client_name: string | null;
  revenueTotalHt: number;
  revenueYearHt: number;
  interventionsCount: number;
  hoursConfirmed: number;
  interventionsWithHours: number;
  hoursConfirmedRatio: number; // 0..1
  realHourlyRate: number | null; // null si pas d'heures confirmées
  targetHourlyRate: number;
  rateRatio: number | null; // realHourlyRate / target
  lastInterventionAt: string | null;
  daysSinceLastIntervention: number | null;
  opportunitiesCount: number;
  opportunitiesValue: number;
  /** Statut de référence de la fiche (certification du référentiel économique). */
  entityStatus: string;
  /** true = identité économique validée humainement. */
  entityCertified: boolean;
  score: ClientScoreLabel;
  recommendation: string;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
}

// ---------- Helpers ----------
const currentYear = _currentYear;
const daysBetween = _daysBetween;

/**
 * Date économique d'une ligne de vente (année/mois du suivi CA).
 * Sert d'unique référence d'ancienneté : aucun compte rendu de chantier ni
 * mission SST n'alimente cette notion.
 */
function saleDateOf(row: { year?: number | null; month?: number | null }): string | null {
  const y = Number(row.year);
  if (!Number.isFinite(y) || y <= 0) return null;
  const m = Math.min(Math.max(Number(row.month) || 1, 1), 12);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function computeConfidenceLevel(
  salesCount: number,
  hoursConfirmed: number,
  hoursConfirmedRatio: number,
): "HIGH" | "MEDIUM" | "LOW" {
  if (
    salesCount >= CONFIDENCE_RULES.HIGH.minInterventions &&
    hoursConfirmedRatio >= CONFIDENCE_RULES.HIGH.minConfirmedHoursRatio &&
    hoursConfirmed > 0
  ) {
    return "HIGH";
  }
  if (
    salesCount >= CONFIDENCE_RULES.MEDIUM.minInterventions &&
    hoursConfirmedRatio >= CONFIDENCE_RULES.MEDIUM.minConfirmedHoursRatio &&
    hoursConfirmed > 0
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function classify(
  s: Omit<ClientScore, "score" | "recommendation">,
): { score: ClientScoreLabel; recommendation: string } {
  const {
    revenueTotalHt,
    revenueYearHt,
    hoursConfirmed,
    hoursConfirmedRatio,
    rateRatio,
    daysSinceLastIntervention,
    entityStatus,
  } = s;

  // Identité économique douteuse (contact classé en client, doublon probable) :
  // aucun score stratégique ne peut être présenté comme fiable.
  if (entityEligibility(entityStatus).level === "non_fiable") {
    return {
      score: "donnees_insuffisantes",
      recommendation:
        "Identité économique à certifier (contact ou doublon probable) — traiter la fiche dans le centre de contrôle du référentiel.",
    };
  }

  const dormantLong =
    daysSinceLastIntervention !== null &&
    daysSinceLastIntervention > SCORE_RULES.LOW_PROFITABILITY.inactivityDays;

  // Données insuffisantes : CA existant mais pas assez d'heures confirmées
  const dataInsufficient =
    revenueTotalHt >= SCORE_RULES.DATA_INSUFFICIENT.minRevenue &&
    (hoursConfirmed <= 0 ||
      hoursConfirmedRatio < SCORE_RULES.DATA_INSUFFICIENT.minConfirmedHoursRatio);

  if (dormantLong) {
    return {
      score: "peu_rentable",
      recommendation:
        "Client dormant depuis plus d'un an — relancer ou archiver.",
    };
  }

  if (dataInsufficient) {
    return {
      score: "donnees_insuffisantes",
      recommendation:
        "Compléter les heures d'intervention pour évaluer la rentabilité.",
    };
  }

  if (rateRatio === null) {
    return {
      score: "donnees_insuffisantes",
      recommendation:
        "Aucune heure confirmée — analyser avant la prochaine intervention.",
    };
  }

  if (
    rateRatio >= SCORE_RULES.STRATEGIC.minRateRatio &&
    revenueYearHt >= SCORE_RULES.STRATEGIC.minRevenueYear &&
    (daysSinceLastIntervention === null ||
      daysSinceLastIntervention <= SCORE_RULES.STRATEGIC.maxInactivityDays)
  ) {
    return {
      score: "strategique",
      recommendation: "Maintenir et fidéliser — proposer un forfait annuel.",
    };
  }

  if (rateRatio < SCORE_RULES.LOW_PROFITABILITY.maxRateRatio) {
    return {
      score: "peu_rentable",
      recommendation:
        "Rentabilité faible — réévaluer le tarif ou le périmètre.",
    };
  }

  // Zone intermédiaire = à optimiser
  return {
    score: "a_optimiser",
    recommendation:
      revenueYearHt < SCORE_RULES.STRATEGIC.minRevenueYear
        ? "Potentiel commercial — relancer pour prestation complémentaire."
        : "Marge perfectible — optimiser le temps passé sur site.",
  };
}

// ---------- Requêtes ----------
// SOURCE ÉCONOMIQUE UNIQUE : Chiffre d'affaires → Ventes.
// Les interventions / CR Chantier ne sont plus lus ici : ils documentent
// l'opérationnel mais ne créent aucune donnée économique.
async function fetchAggregates() {
  const [caRes, oppRes, clientsRes] = await Promise.all([
    supabase
      .from("pilot_ca_entries")
      .select("client_id,year,month,amount_ht,hours,intervention_type,sale_status")
      .eq("kind", "vente"),
    supabase
      .from("v_client_next_best_offers" as never)
      .select("client_id,estimated_value,score_opportunity"),
    supabase.from("clients").select("id,name,entity_status"),
  ]);
  if (caRes.error) throw caRes.error;
  if (clientsRes.error) throw clientsRes.error;
  // opp peut échouer si vue absente : on tolère
  return {
    // Règle de comptabilisation Facturé/Réglé appliquée dès la lecture.
    ca: (caRes.data ?? []).map((r) => accountedSale(r as never)),
    opps: (oppRes.error ? [] : (oppRes.data as unknown as Array<{
      client_id: string;
      estimated_value: number | null;
      score_opportunity: number | null;
    }> ?? [])),
    clients: clientsRes.data ?? [],
  };
}

export async function getClientEconomicScores(): Promise<ClientScore[]> {
  const [{ ca, opps, clients }, settings] = await Promise.all([
    fetchAggregates(),
    getSettings().catch(() => null),
  ]);
  const target =
    settings?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;
  const yr = currentYear();

  const map = new Map<
    string,
    {
      client_id: string;
      client_name: string | null;
      revenueTotalHt: number;
      revenueYearHt: number;
      interventionsCount: number;
      interventionsWithHours: number;
      hoursConfirmed: number;
      caLines: number;
      caLinesWithHours: number;
      /** CA HT des seules lignes de vente porteuses de temps. */
      revenueRatedHt: number;
      lastInterventionAt: string | null;
      opportunitiesCount: number;
      opportunitiesValue: number;
      entityStatus: string;
    }
  >();

  const entityStatusById = new Map<string, string>(
    clients.map((c) => [c.id, (c as { entity_status?: string }).entity_status ?? "manual_review_required"]),
  );

  const ensure = (id: string, name: string | null) => {
    let e = map.get(id);
    if (!e) {
      e = {
        client_id: id,
        client_name: name,
        revenueTotalHt: 0,
        revenueYearHt: 0,
        interventionsCount: 0,
        interventionsWithHours: 0,
        hoursConfirmed: 0,
        caLines: 0,
        caLinesWithHours: 0,
        revenueRatedHt: 0,
        lastInterventionAt: null,
        opportunitiesCount: 0,
        opportunitiesValue: 0,
        entityStatus: entityStatusById.get(id) ?? "manual_review_required",
      };
      map.set(id, e);
    } else if (!e.client_name && name) {
      e.client_name = name;
    }
    return e;
  };

  for (const c of clients) {
    ensure(c.id, c.name);
  }

  for (const r of ca) {
    if (!r.client_id) continue;
    const e = ensure(r.client_id, null);
    const ht = Number(r.amount_ht) || 0;
    e.revenueTotalHt += ht;
    // Dernière activité ÉCONOMIQUE = dernière vente enregistrée (jamais un CR).
    const saleDate = saleDateOf(r);
    if (saleDate && (!e.lastInterventionAt || saleDate > e.lastInterventionAt)) {
      e.lastInterventionAt = saleDate;
    }
    if (Number(r.year) !== yr) continue;
    e.revenueYearHt += ht;
    // Périmètre temporel verrouillé : heures ET CA du taux horaire portent sur
    // les seules lignes de vente de l'exercice courant (source unique
    // Chiffre d'affaires → Ventes → Temps). Aucun mélange d'exercices.
    e.caLines += 1;
    // Nombre d'interventions économiques = lignes de vente de l'exercice.
    e.interventionsCount += 1;
    // Ligne RETENUE = Temps documenté (> 0 h, ou 0 h qualifié SST).
    if (saleRateEligible(r as SaleRateRow)) {
      const h = Number((r as { hours?: number | null }).hours) || 0;
      e.caLinesWithHours += 1;
      e.hoursConfirmed += h;
      e.interventionsWithHours += 1;
      e.revenueRatedHt += ht;
    }
  }

  for (const o of opps) {
    if (!o.client_id) continue;
    const e = ensure(o.client_id, null);
    e.opportunitiesCount += 1;
    e.opportunitiesValue += Number(o.estimated_value) || 0;
  }

  const scores: ClientScore[] = [];
  for (const e of map.values()) {
    // On ignore les clients sans aucune trace économique
    if (
      e.revenueTotalHt === 0 &&
      e.interventionsCount === 0 &&
      e.opportunitiesCount === 0
    ) {
      continue;
    }
    // Taux horaire = CA des lignes RETENUES de l'exercice ÷ Temps de ces mêmes
    // lignes (mêmes lignes au numérateur et au dénominateur).
    const realRate = hourlyRate(e.revenueRatedHt, e.hoursConfirmed);
    const rateRatio = realRate !== null && target > 0 ? realRate / target : null;
    const hoursConfirmedRatio =
      e.caLines > 0 ? e.caLinesWithHours / e.caLines : 0;
    const days = daysBetween(e.lastInterventionAt);

    const confidenceLevel = computeConfidenceLevel(
      e.caLines,
      e.hoursConfirmed,
      hoursConfirmedRatio,
    );

    const base = {
      client_id: e.client_id,
      client_name: e.client_name,
      revenueTotalHt: e.revenueTotalHt,
      revenueYearHt: e.revenueYearHt,
      interventionsCount: e.interventionsCount,
      hoursConfirmed: e.hoursConfirmed,
      interventionsWithHours: e.interventionsWithHours,
      hoursConfirmedRatio,
      realHourlyRate: realRate,
      targetHourlyRate: target,
      rateRatio,
      lastInterventionAt: e.lastInterventionAt,
      daysSinceLastIntervention: days,
      opportunitiesCount: e.opportunitiesCount,
      opportunitiesValue: e.opportunitiesValue,
      entityStatus: e.entityStatus,
      entityCertified: entityEligibility(e.entityStatus).status === "certified_client",
      confidenceLevel,
    };
    const { score, recommendation } = classify(base);
    scores.push({ ...base, score, recommendation });
  }

  scores.sort((a, b) => b.revenueTotalHt - a.revenueTotalHt);
  return scores;
}

export async function getClientEconomicScore(
  clientId: string,
): Promise<ClientScore | null> {
  // Requêtes ciblées sur un seul client — ne charge jamais tout le portefeuille.
  const [caRes, oppRes, clientRes, settings] = await Promise.all([
    supabase
      .from("pilot_ca_entries")
      .select("client_id,year,month,amount_ht,hours,intervention_type,sale_status")
      .eq("kind", "vente")
      .eq("client_id", clientId),
    supabase
      .from("v_client_next_best_offers" as never)
      .select("client_id,estimated_value,score_opportunity")
      .eq("client_id", clientId),
    supabase.from("clients").select("id,name,entity_status").eq("id", clientId).maybeSingle(),
    getSettings().catch(() => null),
  ]);
  if (caRes.error) throw caRes.error;
  if (clientRes.error) throw clientRes.error;

  const ca = (caRes.data ?? []).map((r) => accountedSale(r as never));
  const opps = (oppRes.error
    ? []
    : ((oppRes.data as unknown as Array<{
        client_id: string;
        estimated_value: number | null;
        score_opportunity: number | null;
      }>) ?? [])) as Array<{ estimated_value: number | null; score_opportunity: number | null }>;
  const clientRow =
    (clientRes.data as { id: string; name: string | null; entity_status?: string } | null) ?? null;

  // Aucune trace économique : renvoyer null (fiche gérera l'affichage "données absentes").
  if (ca.length === 0 && opps.length === 0) {
    return null;
  }

  const target =
    settings?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;
  const yr = currentYear();

  let revenueTotalHt = 0;
  let revenueYearHt = 0;
  let revenueRatedHt = 0;
  let hoursConfirmed = 0;
  let caLines = 0;
  let caLinesWithHours = 0;
  let lastInterventionAt: string | null = null;
  for (const r of ca) {
    const ht = Number(r.amount_ht) || 0;
    revenueTotalHt += ht;
    const saleDate = saleDateOf(r);
    if (saleDate && (!lastInterventionAt || saleDate > lastInterventionAt)) {
      lastInterventionAt = saleDate;
    }
    if (Number(r.year) !== yr) continue;
    revenueYearHt += ht;
    // Même exercice = même périmètre (CA + Temps de l'exercice courant).
    caLines += 1;
    // Ligne RETENUE = Temps documenté (> 0 h, ou 0 h qualifié SST).
    if (saleRateEligible(r as SaleRateRow)) {
      const h = Number((r as { hours?: number | null }).hours) || 0;
      caLinesWithHours += 1;
      hoursConfirmed += h;
      revenueRatedHt += ht;
    }
  }

  // Nombre d'interventions économiques = lignes de vente de l'exercice.
  const interventionsCount = caLines;
  const interventionsWithHours = caLinesWithHours;

  let opportunitiesCount = 0;
  let opportunitiesValue = 0;
  for (const o of opps) {
    opportunitiesCount += 1;
    opportunitiesValue += Number(o.estimated_value) || 0;
  }

  // Taux horaire = CA des lignes RETENUES de l'exercice ÷ Temps de ces lignes.
  const realRate = hourlyRate(revenueRatedHt, hoursConfirmed);
  const rateRatio = realRate !== null && target > 0 ? realRate / target : null;
  const hoursConfirmedRatio =
    caLines > 0 ? caLinesWithHours / caLines : 0;
  const days = daysBetween(lastInterventionAt);
  const confidenceLevel = computeConfidenceLevel(caLines, hoursConfirmed, hoursConfirmedRatio);

  const base = {
    client_id: clientId,
    client_name: clientRow?.name ?? null,
    revenueTotalHt,
    revenueYearHt,
    interventionsCount,
    hoursConfirmed,
    interventionsWithHours,
    hoursConfirmedRatio,
    realHourlyRate: realRate,
    targetHourlyRate: target,
    rateRatio,
    lastInterventionAt,
    daysSinceLastIntervention: days,
    opportunitiesCount,
    opportunitiesValue,
    entityStatus: clientRow?.entity_status ?? "manual_review_required",
    entityCertified: entityEligibility(clientRow?.entity_status).status === "certified_client",
    confidenceLevel,
  };
  const { score, recommendation } = classify(base);
  return { ...base, score, recommendation };
}