import type { PilotEntry } from "@/lib/pilot";
import type { ClientScore } from "@/lib/client-score";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import {
  analysisReliability,
  entityEligibility,
  statusOf,
  type EntityStatusMap,
  type Reliability,
} from "@/lib/pilot-entity-rules";
import type { EntityStatus } from "@/lib/pilot-referential";

/**
 * Portefeuille clients enrichi automatiquement à partir des données déjà
 * présentes dans Pilot Pro : CA (pilot_ca_entries), heures (ledger consolidé),
 * scores économiques et prestations observées.
 * Aucune saisie complémentaire n'est demandée : un champ non calculable
 * reste `null` et s'affiche « — ».
 */
export interface PortfolioRow {
  clientId: string;
  name: string;
  caTotal: number;
  caYear: number;
  hours: number;
  hoursSource: "interventions" | "historique" | "ca" | "aucune";
  interventions: number;
  /** Prix de vente moyen par ligne facturée. */
  panierMoyen: number | null;
  prestations: string[];
  /** CA / heures réelles retenues. `null` si non calculable. */
  rentabilite: number | null;
  score: ClientScore["score"] | null;
  recommendation: string | null;
  /** Statut référentiel de l'entité (règle métier centrale). */
  entityStatus: EntityStatus;
  /** L'entité peut-elle alimenter un classement stratégique ? */
  rankable: boolean;
  /** Confiance de la rentabilité affichée (identité + couverture horaire). */
  reliability: Reliability;
}

export function buildPortfolio(params: {
  entries: PilotEntry[];
  ledger: HoursLedgerEntry[];
  scores: ClientScore[];
  year: number;
  /** Statuts référentiels — sans eux, aucune fiche n'est réputée certifiée. */
  statuses?: EntityStatusMap;
}): PortfolioRow[] {
  const { entries, ledger, scores, year, statuses } = params;

  const agg = new Map<
    string,
    { name: string; caTotal: number; caYear: number; lines: number }
  >();
  for (const e of entries) {
    if (!e.client_id) continue;
    const y = new Date(e.entry_date).getFullYear();
    const cur = agg.get(e.client_id) ?? { name: e.client_name ?? "Client", caTotal: 0, caYear: 0, lines: 0 };
    if (e.client_name) cur.name = e.client_name;
    const amount = Number(e.amount_ht) || 0;
    cur.caTotal += amount;
    if (y === year) cur.caYear += amount;
    cur.lines += 1;
    agg.set(e.client_id, cur);
  }

  const hoursByClient = new Map<string, { r: number; h: number; v: number; prestations: Set<string> }>();
  for (const l of ledger) {
    if (!l.clientId || l.hours <= 0) continue;
    const cur = hoursByClient.get(l.clientId) ?? { r: 0, h: 0, v: 0, prestations: new Set<string>() };
    if (l.type === "realisee") {
      if (!l.estimated) cur.r += l.hours;
    } else if (l.type === "historique") cur.h += l.hours;
    else cur.v += l.hours;
    if (l.prestation) cur.prestations.add(l.prestation);
    hoursByClient.set(l.clientId, cur);
  }

  const scoreById = new Map(scores.map((s) => [s.client_id, s]));
  const ids = new Set<string>([...agg.keys(), ...hoursByClient.keys(), ...scoreById.keys()]);

  const rows: PortfolioRow[] = [];
  for (const clientId of ids) {
    const a = agg.get(clientId);
    const s = scoreById.get(clientId);
    const h = hoursByClient.get(clientId);
    const name = a?.name ?? s?.client_name ?? "Client";
    const caTotal = a?.caTotal ?? s?.revenueTotalHt ?? 0;
    const caYear = a?.caYear ?? s?.revenueYearHt ?? 0;
    const hours = h ? (h.r > 0 ? h.r : h.h > 0 ? h.h : h.v) : 0;
    const hoursSource: PortfolioRow["hoursSource"] = !h
      ? "aucune"
      : h.r > 0
        ? "interventions"
        : h.h > 0
          ? "historique"
          : h.v > 0
            ? "ca"
            : "aucune";
    const lines = a?.lines ?? 0;
    const entityStatus = statusOf(statuses, clientId);
    const hoursSourceKey = hoursSource;
    const reliability = analysisReliability({
      entityStatus,
      hours,
      hoursSource: hoursSourceKey,
      caTotal,
    });
    rows.push({
      clientId,
      name,
      caTotal,
      caYear,
      hours,
      hoursSource,
      interventions: s?.interventionsCount ?? lines,
      panierMoyen: lines > 0 ? caTotal / lines : null,
      prestations: h ? [...h.prestations].slice(0, 4) : [],
      rentabilite: hours > 0 && caTotal > 0 ? caTotal / hours : null,
      score: s?.score ?? null,
      recommendation: s?.recommendation ?? null,
      entityStatus,
      rankable: entityEligibility(entityStatus).ranking,
      reliability,
    });
  }

  return rows;
}

/**
 * Tri par rentabilité décroissante. Les entités non exploitables (contacts,
 * doublons) sont reléguées après : un classement stratégique ne doit contenir
 * que des entités économiquement exploitables.
 */
export function sortByProfitability(rows: PortfolioRow[]): PortfolioRow[] {
  return [...rows].sort((a, b) => {
    if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
    if (a.rentabilite != null && b.rentabilite != null) return b.rentabilite - a.rentabilite;
    if (a.rentabilite != null) return -1;
    if (b.rentabilite != null) return 1;
    return b.caTotal - a.caTotal;
  });
}

/** Sous-ensemble exploitable pour les classements / TOP / analyses stratégiques. */
export function strategicRows(rows: PortfolioRow[]): PortfolioRow[] {
  return rows.filter((r) => r.rankable);
}

export function searchPortfolio(rows: PortfolioRow[], query: string): PortfolioRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.name.toLowerCase().includes(q) || r.prestations.some((p) => p.toLowerCase().includes(q)),
  );
}