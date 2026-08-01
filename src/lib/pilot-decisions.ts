// Centre de décision dirigeant (Pilot Pro V2.0).
//
// Ce module n'introduit AUCUN calcul nouveau : il agrège et hiérarchise ce que
// les moteurs existants produisent déjà (recommandations Pilot Pro, opportunités
// commerciales, risques détectés, priorités du jour) pour ne présenter que les
// décisions les plus importantes du moment, réparties en quatre familles :
// actions, opportunités, risques et corrections de données. Aucune donnée
// n'est inventée : chaque décision porte ses sources, son calcul et ses limites.

import type { PilotRecommendation } from "@/lib/pilot-recommendations";
import type { CommercialOpportunity } from "@/lib/pilot-opportunities";
import type { PilotRisk } from "@/lib/pilot-risks";

export type DecisionPriority = "critique" | "elevee" | "moyenne" | "faible";

export type DecisionCategory = "action" | "opportunite" | "risque" | "donnee";

export const DECISION_CATEGORY_META: Record<
  DecisionCategory,
  { label: string; question: string }
> = {
  action: { label: "Priorités", question: "Que dois-je faire aujourd'hui ?" },
  opportunite: { label: "Opportunités", question: "Où puis-je gagner du chiffre d'affaires ?" },
  risque: { label: "Risques", question: "Qu'est-ce qui menace mon entreprise ?" },
  donnee: { label: "Corrections", question: "Quelles données dois-je fiabiliser ?" },
};

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
  /** Mode de calcul lisible (explicabilité totale). */
  calc: string;
  /** Ce que la décision ne dit pas (données manquantes, périmètre). */
  limits: string;
  impactEuro: number | null;
  impactLabel: string;
  action: string;
  priority: DecisionPriority;
  category: DecisionCategory;
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
  /** Priorité de fiabilisation des données plutôt que d'exploitation. */
  isDataFix?: boolean;
}

export function buildDecisions(input: {
  recommendations: PilotRecommendation[];
  opportunities: CommercialOpportunity[];
  priorities: DecisionPriorityInput[];
  risks?: PilotRisk[];
  /** Décisions déjà traitées (réalisée / ignorée) : elles sortent de la liste active. */
  isHandled?: (key: string) => boolean;
  limit?: number;
}): {
  active: PilotDecision[];
  handled: PilotDecision[];
  groups: Record<DecisionCategory, PilotDecision[]>;
} {
  const all: PilotDecision[] = [];

  // 1 — Recommandations Pilot Pro (moteur existant, impact déjà chiffré).
  for (const r of input.recommendations) {
    all.push({
      key: `decision:${r.key}`,
      title: r.title,
      why: r.why,
      sources: r.sources,
      calc: "Recommandation issue des moteurs de rentabilité et de charges Pilot Pro.",
      limits: "L'impact affiché est un ordre de grandeur calculé à données constantes.",
      impactEuro: r.impactEuro,
      impactLabel: r.impactLabel,
      action: r.action,
      priority: priorityFromWeight(r.weight),
      category: "action",
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
      calc:
        o.category === "developpement"
          ? "Score d'opportunité du moteur de prestations recommandées (0-100)."
          : "Comparaison des exercices et de la dernière activité enregistrée du client.",
      limits: "Le montant affiché est une référence passée, pas un engagement du client.",
      impactEuro: o.amount,
      impactLabel:
        o.category === "renouvellement"
          ? "Prix de vente du contrat non reconduit"
          : o.category === "relance"
            ? "Chiffre d'affaires déjà généré par ce client"
            : "Valeur estimée de la prestation proposée",
      action: o.action,
      priority: priorityFromWeight(weight),
      category: "opportunite",
      weight,
      to: o.clientId ? "/pilot/fiche/$clientId" : "/pilot/clients",
      params: o.clientId ? { clientId: o.clientId } : undefined,
    });
  }

  // 3 — Risques détectés automatiquement (moteur pilot-risks).
  for (const r of input.risks ?? []) {
    all.push({
      key: `decision:${r.key}`,
      title: r.title,
      why: r.why,
      sources: r.sources,
      calc: r.calc,
      limits: r.limits,
      impactEuro: r.impactEuro,
      impactLabel: r.impactLabel,
      action: r.action,
      priority: priorityFromWeight(r.weight),
      category: "risque",
      weight: r.weight,
      to: r.to,
    });
  }

  // 4 — Priorités opérationnelles du jour (comptes-rendus, heures, validations…).
  for (const p of input.priorities) {
    all.push({
      key: `decision:${p.key}`,
      title: `${p.label} (${p.count})`,
      why: p.why,
      sources: [p.source],
      calc: "Comptage direct des éléments concernés dans les données enregistrées.",
      limits: "Le comptage ne préjuge pas de l'urgence commerciale de chaque élément.",
      impactEuro: null,
      impactLabel: "Impact non chiffrable : fiabilité des données et suivi client",
      action: p.action,
      priority: priorityFromWeight(p.weight),
      category: p.isDataFix ? "donnee" : "action",
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
  const remaining = input.isHandled ? sorted.filter((d) => !input.isHandled!(d.key)) : sorted;
  const limit = input.limit ?? 5;
  const groups: Record<DecisionCategory, PilotDecision[]> = {
    action: remaining.filter((d) => d.category === "action").slice(0, limit),
    opportunite: remaining.filter((d) => d.category === "opportunite").slice(0, limit),
    risque: remaining.filter((d) => d.category === "risque").slice(0, limit),
    donnee: remaining.filter((d) => d.category === "donnee").slice(0, limit),
  };
  return { active: remaining.slice(0, limit), handled, groups };
}