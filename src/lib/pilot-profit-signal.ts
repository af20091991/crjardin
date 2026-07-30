// Lecture visuelle unique de la rentabilité (Pilot Pro v1.19).
//
// Ce module NE CALCULE RIEN de nouveau : il traduit une valeur déjà calculée
// par les moteurs existants (marge %, taux horaire, classe de rentabilité)
// en un signal unique et identique dans toutes les vues.

import { getThresholds, type PilotThresholds } from "@/lib/pilot-thresholds";
import type { ClientProfitClass } from "@/lib/pilot-client-profitability";
import type { ServiceClass } from "@/lib/pilot-service-profitability";

export type ProfitLevel = "tres_rentable" | "rentable" | "a_surveiller" | "deficitaire" | "inconnu";

export const PROFIT_SIGNAL_META: Record<
  ProfitLevel,
  { label: string; dot: string; badge: string }
> = {
  tres_rentable: {
    label: "Très rentable",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rentable: {
    label: "Rentable",
    dot: "bg-lime-500",
    badge: "border-lime-200 bg-lime-50 text-lime-700",
  },
  a_surveiller: {
    label: "À surveiller",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  deficitaire: {
    label: "Déficitaire",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
  inconnu: {
    label: "Données insuffisantes",
    dot: "bg-muted-foreground/40",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/** Signal à partir d'une marge en % déjà calculée (annualSummary, SST…). */
export function signalFromMarginPct(
  pct: number | null | undefined,
  thresholds?: PilotThresholds,
): ProfitLevel {
  if (pct == null || !Number.isFinite(pct)) return "inconnu";
  const t = thresholds ?? getThresholds();
  if (pct <= 0) return "deficitaire";
  if (pct < t.margeMin) return "a_surveiller";
  if (pct < t.margeMin * 1.5) return "rentable";
  return "tres_rentable";
}

/** Signal à partir d'un taux horaire comparé à la cible (paramètres PP). */
export function signalFromHourlyRate(
  rate: number | null | undefined,
  targetHourlyRate: number,
  thresholds?: PilotThresholds,
): ProfitLevel {
  if (rate == null || !Number.isFinite(rate) || targetHourlyRate <= 0) return "inconnu";
  const t = thresholds ?? getThresholds();
  if (rate >= targetHourlyRate * t.clientTresRentableRatio) return "tres_rentable";
  if (rate >= targetHourlyRate) return "rentable";
  if (rate >= targetHourlyRate * t.clientSurveillerRatio) return "a_surveiller";
  return "deficitaire";
}

/** Signal à partir de la classe client déjà déterminée par le moteur existant. */
export function signalFromClientClass(classe: ClientProfitClass): ProfitLevel {
  switch (classe) {
    case "tres_rentable":
      return "tres_rentable";
    case "rentable":
      return "rentable";
    case "a_surveiller":
      return "a_surveiller";
    case "chronophage":
      return "deficitaire";
    default:
      return "inconnu";
  }
}

/** Signal à partir de la classe prestation déjà déterminée par le moteur existant. */
export function signalFromServiceClass(classe: ServiceClass): ProfitLevel {
  switch (classe) {
    case "rentable":
      return "tres_rentable";
    case "strategique":
      return "rentable";
    case "faible":
      return "a_surveiller";
    default:
      return "inconnu";
  }
}