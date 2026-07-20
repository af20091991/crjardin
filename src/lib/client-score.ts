import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/pilot";

// ---------- Règles de classement (ajustables) ----------
export const SCORE_RULES = {
  STRATEGIC: {
    minRateRatio: 0.95,
    minRevenueYear: 2000,
    maxInactivityDays: 180,
  },
  TO_OPTIMIZE: {
    minRateRatio: 0.75,
  },
  LOW_PROFITABILITY: {
    maxRateRatio: 0.75,
    inactivityDays: 365,
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
  score: ClientScoreLabel;
  recommendation: string;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
}

// ---------- Helpers ----------
function currentYear(): number {
  return new Date().getFullYear();
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
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
  } = s;

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
async function fetchAggregates() {
  const [caRes, ivRes, oppRes, clientsRes] = await Promise.all([
    supabase
      .from("pilot_ca_entries")
      .select("client_id,year,amount_ht")
      .eq("kind", "vente"),
    supabase
      .from("interventions")
      .select("client_id,hours_spent,intervention_date,status")
      .eq("status", "termine"),
    supabase
      .from("v_client_next_best_offers" as never)
      .select("client_id,estimated_value,score_opportunity"),
    supabase.from("clients").select("id,name"),
  ]);
  if (caRes.error) throw caRes.error;
  if (ivRes.error) throw ivRes.error;
  if (clientsRes.error) throw clientsRes.error;
  // opp peut échouer si vue absente : on tolère
  return {
    ca: caRes.data ?? [],
    interventions: ivRes.data ?? [],
    opps: (oppRes.error ? [] : (oppRes.data as unknown as Array<{
      client_id: string;
      estimated_value: number | null;
      score_opportunity: number | null;
    }> ?? [])),
    clients: clientsRes.data ?? [],
  };
}

export async function getClientEconomicScores(): Promise<ClientScore[]> {
  const [{ ca, interventions, opps, clients }, settings] = await Promise.all([
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
      lastInterventionAt: string | null;
      opportunitiesCount: number;
      opportunitiesValue: number;
    }
  >();

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
        lastInterventionAt: null,
        opportunitiesCount: 0,
        opportunitiesValue: 0,
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
    if (Number(r.year) === yr) e.revenueYearHt += ht;
  }

  for (const iv of interventions) {
    if (!iv.client_id) continue;
    const e = ensure(iv.client_id, null);
    e.interventionsCount += 1;
    const h = Number(iv.hours_spent) || 0;
    if (h > 0) {
      e.interventionsWithHours += 1;
      e.hoursConfirmed += h;
    }
    if (iv.intervention_date) {
      if (
        !e.lastInterventionAt ||
        iv.intervention_date > e.lastInterventionAt
      ) {
        e.lastInterventionAt = iv.intervention_date;
      }
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
    const realRate =
      e.hoursConfirmed > 0 ? e.revenueTotalHt / e.hoursConfirmed : null;
    const rateRatio = realRate !== null && target > 0 ? realRate / target : null;
    const hoursConfirmedRatio =
      e.interventionsCount > 0
        ? e.interventionsWithHours / e.interventionsCount
        : 0;
    const days = daysBetween(e.lastInterventionAt);

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
  const all = await getClientEconomicScores();
  return all.find((s) => s.client_id === clientId) ?? null;
}