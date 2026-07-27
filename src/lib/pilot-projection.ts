// Mode Réel / Projection (Pilot Pro v2).
//
// MODE RÉEL      : uniquement ce qui a été réellement enregistré dans PP.
// MODE PROJECTION: extrapolation jusqu'au 31/12 à partir du CA à date, de la
//                  saisonnalité historique observée et des charges constatées.
// Les deux lectures restent strictement séparées : la projection n'écrit
// jamais de donnée et n'est jamais mélangée au réel dans un même total.

import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";
import { realizedChargeRows, realizedEntries } from "@/lib/pilot-realized";

export type PilotMode = "reel" | "projection";

export interface MonthPoint {
  month: number; // 1-12
  ca: number;
  charges: number;
  projected: boolean;
}

export interface ProjectionResult {
  year: number;
  monthsObserved: number;
  caReel: number;
  chargesReelles: number;
  resultatReel: number;
  caProjete: number;
  chargesProjetees: number;
  resultatProjete: number;
  /** Série mensuelle : réel jusqu'au dernier mois observé, projeté ensuite. */
  monthly: MonthPoint[];
  /** "saisonnalite" si des exercices complets antérieurs existent, sinon "moyenne". */
  method: "saisonnalite" | "moyenne" | "aucune";
  confidence: "haute" | "moyenne" | "faible";
  explanation: string;
}

function monthlyCa(entries: PilotEntry[], year: number): number[] {
  const arr = new Array(12).fill(0);
  for (const e of entries) {
    const d = new Date(e.entry_date);
    if (d.getFullYear() !== year) continue;
    arr[d.getMonth()] += Number(e.amount_ht) || 0;
  }
  return arr;
}

function monthlyCharges(rows: ChargeRow[], year: number): number[] {
  const arr = new Array(12).fill(0);
  for (const r of rows) {
    if (r.year !== year) continue;
    const m = Math.min(12, Math.max(1, r.month || 1));
    arr[m - 1] += r.amount_ht;
  }
  return arr;
}

/** Parts mensuelles moyennes issues des exercices complets antérieurs. */
function seasonalShares(entries: PilotEntry[], year: number): number[] | null {
  const byYear = new Map<number, number[]>();
  for (const e of entries) {
    const d = new Date(e.entry_date);
    const y = d.getFullYear();
    if (y >= year) continue;
    const arr = byYear.get(y) ?? new Array(12).fill(0);
    arr[d.getMonth()] += Number(e.amount_ht) || 0;
    byYear.set(y, arr);
  }
  const usable = [...byYear.values()].filter((arr) => {
    const total = arr.reduce((s, v) => s + v, 0);
    const months = arr.filter((v) => v > 0).length;
    return total > 0 && months >= 6;
  });
  if (usable.length === 0) return null;
  const shares = new Array(12).fill(0);
  for (const arr of usable) {
    const total = arr.reduce((s, v) => s + v, 0);
    for (let i = 0; i < 12; i++) shares[i] += arr[i] / total;
  }
  return shares.map((s) => s / usable.length);
}

export function projectYear(params: {
  entries: PilotEntry[];
  charges: ChargeRow[];
  year: number;
  /** Mois courant 1-12 (par défaut : mois réel si l'année est en cours). */
  currentMonth?: number;
}): ProjectionResult {
  const { year } = params;
  const entries = realizedEntries(params.entries);
  const charges = realizedChargeRows(params.charges);
  const now = new Date();
  const isCurrentYear = now.getFullYear() === year;
  const ca = monthlyCa(entries, year);
  const ch = monthlyCharges(charges, year);

  const lastWithData = Math.max(
    ...ca.map((v, i) => (v > 0 ? i + 1 : 0)),
    ...ch.map((v, i) => (v > 0 ? i + 1 : 0)),
    0,
  );
  const monthsObserved = Math.max(
    1,
    params.currentMonth ??
      (isCurrentYear ? Math.min(now.getMonth() + 1, 12) : Math.max(lastWithData, 1)),
  );

  const caReel = ca.reduce((s, v) => s + v, 0);
  const chargesReelles = ch.reduce((s, v) => s + v, 0);

  const shares = seasonalShares(entries, year);
  const cumShare = shares ? shares.slice(0, monthsObserved).reduce((s, v) => s + v, 0) : 0;

  let method: ProjectionResult["method"] = "aucune";
  const monthly: MonthPoint[] = [];
  let caProjete = caReel;
  let chargesProjetees = chargesReelles;

  const chargeAvg = monthsObserved > 0 ? chargesReelles / monthsObserved : 0;

  if (monthsObserved >= 12 || caReel <= 0) {
    method = caReel <= 0 ? "aucune" : "moyenne";
    for (let i = 0; i < 12; i++)
      monthly.push({ month: i + 1, ca: ca[i], charges: ch[i], projected: false });
  } else if (shares && cumShare > 0.05) {
    method = "saisonnalite";
    const annualEstimate = caReel / cumShare;
    for (let i = 0; i < 12; i++) {
      const projected = i + 1 > monthsObserved;
      const mCa = projected ? annualEstimate * shares[i] : ca[i];
      const mCh = projected ? chargeAvg : ch[i];
      monthly.push({ month: i + 1, ca: mCa, charges: mCh, projected });
    }
    caProjete = monthly.reduce((s, m) => s + m.ca, 0);
    chargesProjetees = monthly.reduce((s, m) => s + m.charges, 0);
  } else {
    method = "moyenne";
    const caAvg = caReel / monthsObserved;
    for (let i = 0; i < 12; i++) {
      const projected = i + 1 > monthsObserved;
      monthly.push({
        month: i + 1,
        ca: projected ? caAvg : ca[i],
        charges: projected ? chargeAvg : ch[i],
        projected,
      });
    }
    caProjete = monthly.reduce((s, m) => s + m.ca, 0);
    chargesProjetees = monthly.reduce((s, m) => s + m.charges, 0);
  }

  const confidence: ProjectionResult["confidence"] =
    method === "saisonnalite" && monthsObserved >= 4
      ? "haute"
      : method === "aucune"
        ? "faible"
        : monthsObserved >= 3
          ? "moyenne"
          : "faible";

  const explanation =
    method === "saisonnalite"
      ? `Projection basée sur la saisonnalité des exercices précédents et sur ${monthsObserved} mois observés en ${year}.`
      : method === "moyenne"
        ? `Projection basée sur la moyenne mensuelle des ${monthsObserved} mois observés (pas d'historique saisonnier exploitable).`
        : "Aucune donnée suffisante pour projeter cet exercice.";

  return {
    year,
    monthsObserved,
    caReel,
    chargesReelles,
    resultatReel: caReel - chargesReelles,
    caProjete,
    chargesProjetees,
    resultatProjete: caProjete - chargesProjetees,
    monthly,
    method,
    confidence,
    explanation,
  };
}
