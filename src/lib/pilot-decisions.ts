// Centre de décision dirigeant (Pilot Pro v1.19).
//
// Ce module n'introduit AUCUN calcul nouveau : il agrège et hiérarchise ce que
// les moteurs existants produisent déjà (recommandations Pilot Pro, opportunités
// commerciales, priorités du jour) pour ne présenter que les décisions les plus
// importantes du moment. Aucune donnée n'est inventée.

import type { PilotRecommendation } from "@/lib/pilot-recommendations";
import type { CommercialOpportunity } from "@/lib/pilot-opportunities";

export type DecisionPriority = "critique" | "elevee" | "moyenne" | "faible";

export const DECISION_PRIORITY_META: Record<
  DecisionPriority,
  { label: string; badge: string; rank: number }
> = {
  critique: { label: "Critique", badge: "border-red-200 bg-red-50 text-red-700", rank: 0 },
  elevee: { label: "Élevée", badge: "border-orange-200 bg-orange-50 text-orange-700", rank: 1 },
  moyenne: { label: "Moyenne", badge: "border-amber-200 bg-amber-50 text-amber-700", rank: 2 },
  faible: { label: "Faible", badge: "border-border bg-muted text-muted-foreground", rank: 3 },
};

export interface PilotDecision {
  /** Clé stable, utilisée aussi pour le suivi d'état (À faire / Réalisée…). */
  key: string;
  title: string;
  why: string;
  sources: string[];
  impactEuro: number | null;
  impactLabel: string;
  action: string;
  priority: DecisionPriority;
  weight: number;
  to: string;
  params?: Record<string, string>;
}

function priorityFromWeight(weight: number): DecisionPriority {
  if (weight >= 90) return "critique";
  if (weight >= 70) return "elevee";
  if (weight >= 45) return "moyenne";
  return "faible";
}

/** Priorité du jour telle qu'affichée sur « Aujourd'hui ». */
export interface DecisionPriorityInput {
  key: string;
  label: string;
  count: number;
  why: string;
  source: string;
  action: string;
  to: string;
  params?: Record<string, string>;
  weight: number;
}

export function buildDecisions(input: {
  recommendations: PilotRecommendation[];
  opportunities: CommercialOpportunity[];
  priorities: DecisionPriorityInput[];
  /** Décisions déjà traitées (réalisée / ignorée) : elles sortent de la liste active. */
  isHandled?: (key: string) => boolean;
  limit?: number;
}): { active: PilotDecision[]; handled: PilotDecision[] } {
  const all: PilotDecision[] = [];

  // 1 — Recommandations Pilot Pro (moteur existant, impact déjà chiffré).
  for (const r of input.recommendations) {
    all.push({
      key: `decision:${r.key}`,
      title: r.title,
      why: r.why,
      sources: r.sources,
      impactEuro: r.impactEuro,
      impactLabel: r.impactLabel,
      action: r.action,
      priority: priorityFromWeight(r.weight),
      weight: r.weight,
      to: r.to,
    });
  }

  // 2 — Opportunités commerciales (relance, renouvellement CEEV, développement).
  for (const o of input.opportunities) {
    const weight =
      o.category === "renouvellement" ? 85 : o.category === "relance" ? 65 : 40;
    all.push({
      key: `decision:${o.key}`,
      title:
        o.category === "relance"
          ? `Relancer ${o.title}`
          : o.category === "renouvellement"
            ? `Renouveler le contrat ${o.title}`
            : `Proposer une prestation — ${o.title}`,
      why: o.why,
      sources: [o.source],
      impactEuro: o.amount,
      impactLabel:
        o.category === "renouvellement"
          ? "Prix de vente du contrat non reconduit"
          : o.category === "relance"
            ? "Chiffre d'affaires déjà généré par ce client"
            : "Valeur estimée de la prestation proposée",
      action: o.action,
      priority: priorityFromWeight(weight),
      weight,
      to: o.clientId ? "/pilot/fiche/$clientId" : "/pilot/clients",
      params: o.clientId ? { clientId: o.clientId } : undefined,
    });
  }

  // 3 — Priorités opérationnelles du jour (comptes-rendus, heures, validations…).
  for (const p of input.priorities) {
    all.push({
      key: `decision:${p.key}`,
      title: `${p.label} (${p.count})`,
      why: p.why,
      sources: [p.source],
      impactEuro: null,
      impactLabel: "Impact non chiffrable : fiabilité des données et suivi client",
      action: p.action,
      priority: priorityFromWeight(p.weight),
      weight: p.weight,
      to: p.to,
      params: p.params,
    });
  }

  const sorted = all.sort((a, b) => {
    const pr = DECISION_PRIORITY_META[a.priority].rank - DECISION_PRIORITY_META[b.priority].rank;
    if (pr !== 0) return pr;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return (b.impactEuro ?? 0) - (a.impactEuro ?? 0);
  });

  const handled = input.isHandled ? sorted.filter((d) => input.isHandled!(d.key)) : [];
  const active = (input.isHandled ? sorted.filter((d) => !input.isHandled!(d.key)) : sorted).slice(
    0,
    input.limit ?? 5,
  );
  return { active, handled };
}