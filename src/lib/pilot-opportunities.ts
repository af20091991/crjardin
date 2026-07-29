// Opportunités commerciales — lecture simple et directement actionnable.
//
// Trois familles, uniquement à partir de données déjà enregistrées :
//  · Relances       : clients sans activité récente (règles client-activity)
//  · Renouvellements: contrats CEEV de l'exercice précédent absents cette année
//  · Développement  : prestations recommandées par le moteur existant (NBO)
//
// Aucun calcul nouveau, aucune donnée inventée : si l'information manque,
// l'opportunité n'est pas proposée.

import type { ClientActivityRow } from "@/lib/client-activity";
import { renewalAnalysis, type CeevContract } from "@/lib/ceev";

/** Vue minimale d'une prestation recommandée (moteur NBO existant). */
export interface OfferInput {
  client_id: string;
  service_id: string;
  service_name: string;
  score_opportunity: number;
  estimated_value?: number | null;
}

export type OpportunityCategory = "relance" | "renouvellement" | "developpement";

export const OPPORTUNITY_META: Record<
  OpportunityCategory,
  { label: string; question: string }
> = {
  relance: {
    label: "Relances",
    question: "Quels clients n'ont plus donné signe de vie ?",
  },
  renouvellement: {
    label: "Contrats à renouveler",
    question: "Quels contrats d'entretien n'ont pas été reconduits ?",
  },
  developpement: {
    label: "Développement possible",
    question: "Quelles prestations puis-je proposer en plus ?",
  },
};

export interface CommercialOpportunity {
  key: string;
  category: OpportunityCategory;
  title: string;
  /** Pourquoi Pilot Pro propose cette opportunité. */
  why: string;
  /** Données réellement utilisées. */
  source: string;
  action: string;
  /** Montant de référence (CA passé, valeur du contrat…), jamais inventé. */
  amount: number | null;
  clientId: string | null;
  weight: number;
}

const DAY_MS = 86_400_000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export function buildCommercialOpportunities(input: {
  activity: ClientActivityRow[];
  ceev: CeevContract[];
  offers: OfferInput[];
  clientNameById: Map<string, string>;
  year: number;
  limitPerCategory?: number;
}): CommercialOpportunity[] {
  const { activity, ceev, offers, clientNameById, year } = input;
  const limit = input.limitPerCategory ?? 5;
  const out: CommercialOpportunity[] = [];

  // 1 — Relances : clients à relancer ou dormants ayant déjà généré du CA.
  const relances = activity
    .filter((c) => c.status !== "actif" && c.caTotal > 0)
    .sort((a, b) => b.caTotal - a.caTotal)
    .slice(0, limit);
  for (const c of relances) {
    const d = daysSince(c.lastActivity);
    out.push({
      key: `relance:${c.id}`,
      category: "relance",
      title: c.name,
      why:
        d != null
          ? `Aucune activité depuis ${d} jours alors que ce client a déjà généré du chiffre d'affaires.`
          : "Aucune activité enregistrée pour ce client depuis son entrée au fichier.",
      source: "Interventions et ventes rattachées au client",
      action: "Reprendre contact et proposer une intervention.",
      amount: c.caTotal,
      clientId: c.id,
      weight: c.caTotal,
    });
  }

  // 2 — Renouvellements : contrats CEEV de N-1 absents de l'exercice courant.
  const { notRenewed } = renewalAnalysis(ceev, year - 1, year);
  for (const c of [...notRenewed].sort((a, b) => b.pv_ht - a.pv_ht).slice(0, limit)) {
    out.push({
      key: `ceev:${c.id}`,
      category: "renouvellement",
      title: c.label || c.raw_label,
      why: `Contrat d'entretien présent en ${year - 1} et absent de l'exercice ${year}.`,
      source: "Contrats CEEV importés",
      action: "Confirmer la reconduction ou acter la perte du contrat.",
      amount: c.pv_ht,
      clientId: c.client_id,
      weight: c.pv_ht,
    });
  }

  // 3 — Développement : prestations proposées par le moteur existant.
  for (const o of [...offers].sort((a, b) => b.score_opportunity - a.score_opportunity).slice(0, limit)) {
    out.push({
      key: `nbo:${o.client_id}:${o.service_id}`,
      category: "developpement",
      title: `${clientNameById.get(o.client_id) ?? "Client"} — ${o.service_name}`,
      why: `Prestation cohérente avec l'historique du client (score ${Math.round(o.score_opportunity)}/100).`,
      source: "Historique des prestations, saisonnalité et catalogue",
      action: "Proposer cette prestation lors du prochain échange.",
      amount: o.estimated_value ?? null,
      clientId: o.client_id,
      weight: o.score_opportunity,
    });
  }

  return out;
}