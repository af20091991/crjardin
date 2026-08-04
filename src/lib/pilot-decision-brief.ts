// Jeu de données décisionnel (Pilot Pro v2 — préparation assistant IA).
//
// Ne produit AUCUNE interface : agrège les réponses factuelles aux questions
// de direction à partir des modules déjà en place. L'assistant IA pourra
// consommer cette structure telle quelle.

import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import type { ClientActivityRow } from "@/lib/client-activity";
import { classifyClients, type ClientProfitability } from "@/lib/pilot-client-profitability";
import { analyzeServices, type ServiceProfitability } from "@/lib/pilot-service-profitability";
import { projectYear, type ProjectionResult } from "@/lib/pilot-projection";
import { annualSummary, type AnnualRow } from "@/lib/pilot-annual";
import { getThresholds } from "@/lib/pilot-thresholds";
import type { EntityStatusMap } from "@/lib/pilot-entity-rules";

export interface DecisionBrief {
  year: number;
  /** Quels clients contacter ? */
  clientsAContacter: { clientId: string; name: string; raison: string; caTotal: number }[];
  /** Où perd-on de la rentabilité ? */
  pertesRentabilite: { sujet: string; detail: string; impact: number | null }[];
  /** Quelles prestations développer ? */
  prestationsADevelopper: ServiceProfitability[];
  /** Quels investissements envisager ? (marge disponible constatée) */
  capaciteInvestissement: { margeDisponible: number; margePct: number | null; commentaire: string };
  /** L'objectif annuel est-il atteignable ? */
  objectifAnnuel: {
    objectif: number | null;
    caReel: number;
    caProjete: number;
    atteignable: boolean | null;
    commentaire: string;
  };
  projection: ProjectionResult;
  annuel: AnnualRow[];
  clients: ClientProfitability[];
  prestations: ServiceProfitability[];
}

export function buildDecisionBrief(params: {
  entries: PilotEntry[];
  charges: ChargeRow[];
  ledger: HoursLedgerEntry[];
  activity?: ClientActivityRow[];
  year: number;
  targetHourlyRate: number;
  objectifAnnuel?: number | null;
  statuses?: EntityStatusMap;
}): DecisionBrief {
  const t = getThresholds();
  const { entries, charges, ledger, year, targetHourlyRate } = params;

  const clients = classifyClients({ entries, ledger, year, targetHourlyRate, statuses: params.statuses });
  const prestations = analyzeServices({ entries, ledger, year, targetHourlyRate });
  const projection = projectYear({ entries, charges, year });
  const annuel = annualSummary(entries, charges);

  // 1) Clients à contacter : dormants/à relancer du référentiel + clients rentables en recul.
  const clientsAContacter: DecisionBrief["clientsAContacter"] = [];
  for (const a of params.activity ?? []) {
    if (a.status === "dormant" || a.status === "a_relancer") {
      clientsAContacter.push({
        clientId: a.id,
        name: a.name,
        raison:
          a.status === "dormant"
            ? "Aucune activité depuis plus de 12 mois."
            : "Aucune activité depuis plus de 6 mois.",
        caTotal: a.caTotal || (clients.find((c) => c.clientId === a.id)?.caTotal ?? 0),
      });
    }
  }
  for (const c of clients) {
    if (c.evolutionPct != null && c.evolutionPct <= -t.baisseActivitePct && c.caTotal > 0) {
      if (clientsAContacter.some((x) => x.clientId === c.clientId)) continue;
      clientsAContacter.push({
        clientId: c.clientId,
        name: c.name,
        raison: `CA en recul de ${Math.abs(c.evolutionPct).toFixed(0)} % vs ${year - 1}.`,
        caTotal: c.caTotal,
      });
    }
  }
  clientsAContacter.sort((a, b) => b.caTotal - a.caTotal);

  // 2) Pertes de rentabilité : clients chronophages + prestations faibles.
  const pertesRentabilite: DecisionBrief["pertesRentabilite"] = [];
  for (const c of clients.filter((x) => x.classe === "chronophage").slice(0, 10)) {
    pertesRentabilite.push({
      sujet: `Client ${c.name}`,
      detail: c.why,
      impact: c.tauxHoraire != null ? (targetHourlyRate - c.tauxHoraire) * c.hours : null,
    });
  }
  for (const p of prestations.filter((x) => x.classe === "faible").slice(0, 10)) {
    const hours = p.hoursBasis === "reelles" ? p.heuresReelles : p.heuresVendues;
    pertesRentabilite.push({
      sujet: `Prestation ${p.prestation}`,
      detail: p.why,
      impact: p.tauxHoraire != null ? (targetHourlyRate - p.tauxHoraire) * hours : null,
    });
  }
  pertesRentabilite.sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));

  // 3) Prestations à développer : rentables/stratégiques en croissance ou sous-diffusées.
  const prestationsADevelopper = prestations
    .filter((p) => p.classe === "rentable" || p.classe === "strategique")
    .sort((a, b) => (b.tauxHoraire ?? 0) - (a.tauxHoraire ?? 0))
    .slice(0, 8);

  // 4) Capacité d'investissement : marge constatée sur l'exercice.
  const margeDisponible = projection.resultatReel;
  const margePct = projection.caReel > 0 ? (margeDisponible / projection.caReel) * 100 : null;
  const capaciteInvestissement = {
    margeDisponible,
    margePct,
    commentaire:
      margePct == null
        ? "Aucun CA enregistré sur l'exercice : capacité d'investissement non évaluable."
        : margePct >= t.margeMin
          ? `Marge de ${margePct.toFixed(0)} % au-dessus du seuil de ${t.margeMin} % : capacité d'investissement constatée de ${Math.round(margeDisponible)} €.`
          : `Marge de ${margePct.toFixed(0)} % sous le seuil de ${t.margeMin} % : prudence avant tout investissement.`,
  };

  // 5) Objectif annuel.
  const objectif = params.objectifAnnuel ?? null;
  const atteignable = objectif != null && objectif > 0 ? projection.caProjete >= objectif : null;
  const objectifAnnuel = {
    objectif,
    caReel: projection.caReel,
    caProjete: projection.caProjete,
    atteignable,
    commentaire:
      objectif == null || objectif <= 0
        ? "Aucun objectif annuel de CA défini dans Pilot Pro."
        : atteignable
          ? `Projection ${Math.round(projection.caProjete)} € ≥ objectif ${Math.round(objectif)} € (${projection.explanation})`
          : `Projection ${Math.round(projection.caProjete)} € en deçà de l'objectif ${Math.round(objectif)} € (${projection.explanation})`,
  };

  return {
    year,
    clientsAContacter: clientsAContacter.slice(0, 20),
    pertesRentabilite: pertesRentabilite.slice(0, 12),
    prestationsADevelopper,
    capaciteInvestissement,
    objectifAnnuel,
    projection,
    annuel,
    clients,
    prestations,
  };
}
