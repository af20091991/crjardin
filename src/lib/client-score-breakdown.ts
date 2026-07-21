import type { ClientScore } from "@/lib/client-score";

export interface ScoreBreakdown {
  rentabilite: { value: number; max: number; note: string };
  relation: { value: number; max: number; note: string };
  potentiel: { value: number; max: number; note: string };
  recence: { value: number; max: number; note: string };
  total: number;
  strengths: string[];
  weaknesses: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Score client 0-100 décomposé en 4 axes explicables.
 * Alimenté depuis un ClientScore déjà calculé (aucune nouvelle requête).
 */
export function computeScoreBreakdown(s: ClientScore): ScoreBreakdown {
  // Rentabilité (0-30) : ratio réel / cible mappé [0.6→0, 1.0→30, ≥1.2→30]
  let rentabilite: ScoreBreakdown["rentabilite"];
  if (s.rateRatio === null) {
    rentabilite = {
      value: 0,
      max: 30,
      note: "Heures non confirmées — rentabilité non calculable.",
    };
  } else {
    const v = clamp(((s.rateRatio - 0.6) / 0.4) * 30, 0, 30);
    const pct = Math.round(s.rateRatio * 100);
    rentabilite = {
      value: Math.round(v),
      max: 30,
      note: `Taux réel ${pct} % de la cible (${s.realHourlyRate?.toFixed(0) ?? "—"} €/h vs ${s.targetHourlyRate.toFixed(0)} €/h).`,
    };
  }

  // Relation (0-25) : nb interventions confirmées (6+ → 25)
  const relValue = clamp((s.interventionsCount / 6) * 25, 0, 25);
  const relation: ScoreBreakdown["relation"] = {
    value: Math.round(relValue),
    max: 25,
    note:
      s.interventionsCount === 0
        ? "Aucune intervention enregistrée."
        : `${s.interventionsCount} intervention(s) terminée(s).`,
  };

  // Potentiel (0-25) : opportunités NBO (nb + valeur estimée)
  const potCount = clamp((s.opportunitiesCount / 3) * 15, 0, 15);
  const potValue = clamp((s.opportunitiesValue / 2000) * 10, 0, 10);
  const potentiel: ScoreBreakdown["potentiel"] = {
    value: Math.round(potCount + potValue),
    max: 25,
    note:
      s.opportunitiesCount === 0
        ? "Aucune opportunité détectée."
        : `${s.opportunitiesCount} offre(s) — valeur estimée ${s.opportunitiesValue.toFixed(0)} €.`,
  };

  // Récence (0-20) : jours depuis dernière intervention
  let recence: ScoreBreakdown["recence"];
  if (s.daysSinceLastIntervention === null) {
    recence = { value: 0, max: 20, note: "Aucune activité enregistrée." };
  } else {
    const v = clamp(20 - (s.daysSinceLastIntervention / 365) * 20, 0, 20);
    recence = {
      value: Math.round(v),
      max: 20,
      note: `Dernière intervention il y a ${s.daysSinceLastIntervention} j.`,
    };
  }

  const total = rentabilite.value + relation.value + potentiel.value + recence.value;

  // Points forts / faibles
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (rentabilite.value >= 22) strengths.push("Rentabilité horaire au-dessus de la cible.");
  else if (s.rateRatio !== null && rentabilite.value < 10) weaknesses.push("Rentabilité horaire nettement sous la cible.");
  if (relation.value >= 18) strengths.push("Fréquence d'interventions élevée.");
  else if (relation.value < 8) weaknesses.push("Peu d'interventions confirmées — relation à consolider.");
  if (potentiel.value >= 15) strengths.push("Potentiel commercial significatif à activer.");
  else if (potentiel.value === 0) weaknesses.push("Aucune opportunité commerciale détectée.");
  if (recence.value >= 15) strengths.push("Client récent, relation active.");
  else if (recence.value < 5) weaknesses.push("Aucune activité récente — risque de perte.");
  if (s.revenueYearHt > 2000) strengths.push(`CA annuel solide (${s.revenueYearHt.toFixed(0)} €).`);

  return { rentabilite, relation, potentiel, recence, total, strengths, weaknesses };
}