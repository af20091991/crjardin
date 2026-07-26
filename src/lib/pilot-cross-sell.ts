// Recommandations commerciales par client (Pilot Pro v2).
//
// « Quelles ventes additionnelles proposer à ce client ? »
// Basé UNIQUEMENT sur l'historique déjà présent dans PP :
//  - prestations déjà réalisées par le client ;
//  - prestations absentes de son historique mais courantes dans le portefeuille ;
//  - saisonnalité observée de chaque prestation (mois de facturation historiques).
// Aucune donnée n'est inventée : potentiel = panier moyen constaté.

import type { PilotEntry } from "@/lib/pilot";
import { prestationKey } from "@/lib/pilot-service-profitability";

export interface CrossSellSuggestion {
  prestation: string;
  /** Pourquoi PP propose cette prestation. */
  justification: string;
  /** Potentiel € = panier moyen constaté sur cette prestation. */
  potentiel: number;
  confidence: "haute" | "moyenne" | "faible";
  /** Mois les plus facturés pour cette prestation (1-12). */
  saison: number[];
  /** true si le client a déjà acheté cette prestation (relance de fréquence). */
  dejaRealisee: boolean;
  /** Jours depuis le dernier achat de cette prestation par ce client. */
  joursDepuis: number | null;
}

interface ServiceStat {
  lignes: number;
  ca: number;
  clients: Set<string>;
  months: number[]; // compteur par mois
}

function buildServiceStats(entries: PilotEntry[]): Map<string, ServiceStat> {
  const map = new Map<string, ServiceStat>();
  for (const e of entries) {
    const key = prestationKey(e.client_name, e.nature, e.family);
    const cur = map.get(key) ?? { lignes: 0, ca: 0, clients: new Set<string>(), months: new Array(12).fill(0) };
    cur.lignes += 1;
    cur.ca += Number(e.amount_ht) || 0;
    if (e.client_id) cur.clients.add(e.client_id);
    const m = new Date(e.entry_date).getMonth();
    if (m >= 0 && m < 12) cur.months[m] += 1;
    map.set(key, cur);
  }
  return map;
}

function topMonths(months: number[]): number[] {
  const total = months.reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  const avg = total / 12;
  return months.map((v, i) => ({ v, m: i + 1 })).filter((x) => x.v > avg).map((x) => x.m);
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function formatMonths(months: number[]): string {
  if (months.length === 0 || months.length === 12) return "toute l'année";
  return months.map((m) => MONTHS_FR[m - 1]).join(", ");
}

export function suggestCrossSell(params: {
  clientId: string;
  entries: PilotEntry[];
  /** Nombre total de clients distincts du portefeuille (pour la confiance). */
  now?: Date;
  limit?: number;
}): CrossSellSuggestion[] {
  const { clientId, entries } = params;
  const now = params.now ?? new Date();
  const stats = buildServiceStats(entries);
  const totalClients = new Set(entries.filter((e) => e.client_id).map((e) => e.client_id)).size;

  const clientEntries = entries.filter((e) => e.client_id === clientId);
  if (clientEntries.length === 0) return [];

  const clientLast = new Map<string, number>();
  for (const e of clientEntries) {
    const key = prestationKey(e.client_name, e.nature, e.family);
    const t = new Date(e.entry_date).getTime();
    clientLast.set(key, Math.max(clientLast.get(key) ?? 0, t));
  }

  const currentMonth = now.getMonth() + 1;
  const out: CrossSellSuggestion[] = [];

  for (const [prestation, s] of stats) {
    if (s.lignes < 3 || s.clients.size < 2) continue; // prestation trop rare pour être proposée
    const panier = s.ca / s.lignes;
    if (panier <= 0) continue;
    const saison = topMonths(s.months);
    const inSeason = saison.length === 0 || saison.includes(currentMonth);
    const last = clientLast.get(prestation);
    const penetration = totalClients > 0 ? s.clients.size / totalClients : 0;

    if (last == null) {
      // Prestation absente de l'historique client.
      out.push({
        prestation,
        justification: `Jamais facturée à ce client alors que ${s.clients.size} clients du portefeuille en bénéficient (${(penetration * 100).toFixed(0)} %)${inSeason ? " — période favorable actuellement" : ""}.`,
        potentiel: panier,
        confidence: s.clients.size >= 10 ? "haute" : s.clients.size >= 5 ? "moyenne" : "faible",
        saison,
        dejaRealisee: false,
        joursDepuis: null,
      });
    } else {
      const jours = Math.round((now.getTime() - last) / 86_400_000);
      if (jours >= 300) {
        out.push({
          prestation,
          justification: `Déjà réalisée chez ce client il y a ${jours} jours${saison.length ? `, période habituelle : ${formatMonths(saison)}` : ""}${inSeason ? " — période favorable actuellement" : ""}.`,
          potentiel: panier,
          confidence: "haute",
          saison,
          dejaRealisee: true,
          joursDepuis: jours,
        });
      }
    }
  }

  const rank = (s: CrossSellSuggestion) =>
    (s.dejaRealisee ? 1.3 : 1) *
    (s.saison.length === 0 || s.saison.includes(currentMonth) ? 1.3 : 1) *
    (s.confidence === "haute" ? 1.3 : s.confidence === "moyenne" ? 1.1 : 1) *
    s.potentiel;

  return out.sort((a, b) => rank(b) - rank(a)).slice(0, params.limit ?? 5);
}