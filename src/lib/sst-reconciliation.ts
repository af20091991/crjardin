// RAPPROCHEMENT SST — LECTURE SEULE, LIGNE PAR LIGNE.
//
// Objectif unique : expliquer l'écart entre le coût des missions de
// sous-traitance (`subcontractor_missions`) et les charges de sous-traitance
// constatées dans `pilot_ca_entries` (kind = 'charge').
//
// Règles non négociables :
//  - aucune donnée n'est créée, modifiée ou supprimée ;
//  - aucun total n'est forcé : un écart non démontré reste visible et classé ;
//  - chaque ligne des deux ensembles est comptée UNE SEULE FOIS ;
//  - total rapproché + total non rapproché = total de chaque source ;
//  - les investissements et rémunérations ne sont jamais mélangés aux charges
//    de sous-traitance (filtrage déjà appliqué en amont par `sstChargeLines`).

import type { SstChargeLine } from "@/lib/sst-charges";
import type { IntegrityStatus } from "@/lib/pilot-integrity";
import { worstIntegrity } from "@/lib/pilot-integrity";
import { isRealizedMonth, type PeriodMode } from "@/lib/pilot-realized";

/** Classification imposée de chaque ligne du rapprochement. */
export type SstMatchKind =
  | "correspondance_exacte"
  | "arrondi"
  | "charge_sans_mission"
  | "mission_sans_charge"
  | "doublon"
  | "mauvais_sous_traitant"
  | "mauvais_perimetre"
  | "difference_periode"
  | "montant_incoherent"
  | "anomalie";

export const SST_MATCH_LABEL: Record<SstMatchKind, string> = {
  correspondance_exacte: "Correspondance exacte",
  arrondi: "Différence d'arrondi",
  charge_sans_mission: "Charge sans mission",
  mission_sans_charge: "Mission sans charge",
  doublon: "Doublon",
  mauvais_sous_traitant: "Mauvais sous-traitant",
  mauvais_perimetre: "Mauvais périmètre",
  difference_periode: "Différence de période",
  montant_incoherent: "Montant incohérent",
  anomalie: "Anomalie non résolue",
};

const STATUS_BY_KIND: Record<SstMatchKind, IntegrityStatus> = {
  correspondance_exacte: "certifie",
  arrondi: "certifie",
  charge_sans_mission: "incomplet",
  mission_sans_charge: "incomplet",
  doublon: "suspect",
  mauvais_sous_traitant: "suspect",
  mauvais_perimetre: "suspect",
  difference_periode: "incomplet",
  montant_incoherent: "suspect",
  anomalie: "suspect",
};

/** Tolérance d'arrondi (euros). Au-delà, l'écart doit être expliqué. */
export const SST_TOLERANCE = 0.01;

/** Mission ramenée aux seules informations nécessaires au rapprochement. */
export interface SstMissionRef {
  id: string;
  /** Date de mission (ISO, AAAA-MM-JJ). */
  date: string;
  year: number;
  month: number;
  /** Coût SST retenu : montant facturé, sinon prix convenu. */
  amount: number;
  sstName: string;
  clientName: string | null;
  label: string;
}

export interface SstMatchRow {
  id: string;
  kind: SstMatchKind;
  status: IntegrityStatus;
  missionId: string | null;
  chargeId: string | null;
  /** Montant côté missions retenu par cette ligne (0 si aucune mission). */
  missionAmount: number;
  /** Montant côté charges retenu par cette ligne (0 si aucune charge). */
  chargeAmount: number;
  gap: number;
  label: string;
  message: string;
}

export interface SstReconciliationReport {
  rows: SstMatchRow[];
  /** Totaux des deux périmètres AVANT tout rapprochement. */
  missionTotal: number;
  chargeTotal: number;
  missionCount: number;
  chargeCount: number;
  /** Montants effectivement rapprochés de part et d'autre. */
  matchedMissionTotal: number;
  matchedChargeTotal: number;
  unmatchedMissionTotal: number;
  unmatchedChargeTotal: number;
  /** Écart brut restant entre les deux périmètres (missions − charges). */
  gap: number;
  status: IntegrityStatus;
  periode: string;
  message: string;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string | null): string[] {
  return norm(s ?? "")
    .split(" ")
    .filter((t) => t.length >= 4);
}

/** Vrai si le libellé de charge cite le sous-traitant ou le client de la mission. */
function sameParty(mission: SstMissionRef, charge: SstChargeLine): boolean {
  const hay = norm(`${charge.designation} ${charge.provider} ${charge.clientName ?? ""}`);
  const sstHit = tokens(mission.sstName).some((t) => hay.includes(t));
  const clientHit = tokens(mission.clientName).some((t) => hay.includes(t));
  return sstHit || clientHit;
}

/** Vrai si la charge cite explicitement un AUTRE sous-traitant connu. */
function citesOtherSst(
  mission: SstMissionRef,
  charge: SstChargeLine,
  sstNames: readonly string[],
): boolean {
  const hay = norm(`${charge.designation} ${charge.provider}`);
  const own = norm(mission.sstName);
  return sstNames.some((n) => {
    const nn = norm(n);
    if (!nn || nn === own || nn.length < 4) return false;
    return hay.includes(nn);
  });
}

const money = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const ym = (year: number, month: number) => `${String(month).padStart(2, "0")}/${year}`;

export interface SstReconciliationInput {
  missions: readonly SstMissionRef[];
  chargeLines: readonly SstChargeLine[];
  /** Exercice contrôlé. Les deux côtés sont filtrés à l'identique. */
  year: number;
  /** « À date » par défaut : les mois futurs sont exclus des deux côtés. */
  period?: PeriodMode;
  /** Noms des sous-traitants connus (détection d'un mauvais rattachement). */
  sstNames?: readonly string[];
  now?: Date;
}

/**
 * Rapprochement déterministe en quatre passes, chaque ligne étant consommée au
 * plus une fois :
 *  1. même mois + même montant  → correspondance exacte (ou arrondi) ;
 *  2. même mois + montant proche (≤ 1 €) et même partie → arrondi ;
 *  3. même montant, mois différent, même partie → différence de période ;
 *  4. même mois et même partie, montant différent → montant incohérent.
 * Le reste est déclaré « charge sans mission » ou « mission sans charge ».
 */
export function buildSstReconciliation(input: SstReconciliationInput): SstReconciliationReport {
  const { year, period = "a_date", sstNames = [], now = new Date() } = input;
  const inPeriod = (y: number, m: number) =>
    y === year && (period === "exercice_complet" || isRealizedMonth(y, m, now));

  const missions = input.missions
    .filter((m) => inPeriod(m.year, m.month))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const charges = input.chargeLines
    .filter((c) => inPeriod(c.year, c.month))
    .slice()
    .sort((a, b) => a.month - b.month);

  const missionTotal = missions.reduce((s, m) => s + m.amount, 0);
  const chargeTotal = charges.reduce((s, c) => s + c.amount, 0);

  const rows: SstMatchRow[] = [];
  const usedMissions = new Set<string>();
  const usedCharges = new Set<string>();

  // Doublons stricts côté charges : même mois, même montant, même libellé.
  const seen = new Map<string, string>();
  for (const c of charges) {
    const key = `${c.month}|${c.amount.toFixed(2)}|${norm(c.designation)}`;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, c.id);
      continue;
    }
    usedCharges.add(c.id);
    rows.push({
      id: `dup-${c.id}`,
      kind: "doublon",
      status: STATUS_BY_KIND.doublon,
      missionId: null,
      chargeId: c.id,
      missionAmount: 0,
      chargeAmount: c.amount,
      gap: c.amount,
      label: `${c.designation} — ${ym(c.year, c.month)}`,
      message: `Charge en double du même libellé et du même montant (${money(c.amount)}) sur ${ym(
        c.year,
        c.month,
      )} — comptée une seule fois, l'occurrence supplémentaire reste à trancher.`,
    });
  }

  const pair = (
    m: SstMissionRef,
    c: SstChargeLine,
    kind: SstMatchKind,
    message: string,
  ): void => {
    usedMissions.add(m.id);
    usedCharges.add(c.id);
    rows.push({
      id: `${m.id}-${c.id}`,
      kind,
      status: STATUS_BY_KIND[kind],
      missionId: m.id,
      chargeId: c.id,
      missionAmount: m.amount,
      chargeAmount: c.amount,
      gap: Math.abs(m.amount - c.amount),
      label: `${m.sstName} ${m.clientName ? `/ ${m.clientName} ` : ""}— ${c.designation}`,
      message,
    });
  };

  const free = (c: SstChargeLine) => !usedCharges.has(c.id);

  // Passe 1 — même mois, même montant.
  for (const m of missions) {
    if (usedMissions.has(m.id)) continue;
    const exact = charges.find(
      (c) => free(c) && c.month === m.month && Math.abs(c.amount - m.amount) <= SST_TOLERANCE,
    );
    if (!exact) continue;
    if (citesOtherSst(m, exact, sstNames)) {
      pair(
        m,
        exact,
        "mauvais_sous_traitant",
        `Montant et mois identiques (${money(m.amount)}, ${ym(m.year, m.month)}) mais la charge cite un autre sous-traitant que « ${m.sstName} » : rattachement à confirmer.`,
      );
      continue;
    }
    pair(
      m,
      exact,
      "correspondance_exacte",
      sameParty(m, exact)
        ? `Mission et charge concordent : ${money(m.amount)} en ${ym(m.year, m.month)}.`
        : `Rapprochée sur le mois et le montant (${money(m.amount)}, ${ym(m.year, m.month)}) ; le libellé de charge ne nomme ni le sous-traitant ni le client.`,
    );
  }

  // Passe 2 — même mois, même partie, écart d'arrondi (≤ 1 €).
  for (const m of missions) {
    if (usedMissions.has(m.id)) continue;
    const near = charges.find(
      (c) =>
        free(c) &&
        c.month === m.month &&
        sameParty(m, c) &&
        Math.abs(c.amount - m.amount) <= 1,
    );
    if (!near) continue;
    pair(
      m,
      near,
      "arrondi",
      `Écart d'arrondi de ${money(Math.abs(near.amount - m.amount))} entre la mission (${money(
        m.amount,
      )}) et la charge (${money(near.amount)}).`,
    );
  }

  // Passe 3 — même montant, mois différent, même partie.
  for (const m of missions) {
    if (usedMissions.has(m.id)) continue;
    const shifted = charges.find(
      (c) => free(c) && Math.abs(c.amount - m.amount) <= SST_TOLERANCE && sameParty(m, c),
    );
    if (!shifted) continue;
    pair(
      m,
      shifted,
      "difference_periode",
      `Même montant (${money(m.amount)}) mais mois différents : mission ${ym(
        m.year,
        m.month,
      )}, charge ${ym(shifted.year, shifted.month)} — décalage de facturation à confirmer.`,
    );
  }

  // Passe 4 — même mois et même partie, montant différent.
  for (const m of missions) {
    if (usedMissions.has(m.id)) continue;
    const same = charges.find((c) => free(c) && c.month === m.month && sameParty(m, c));
    if (!same) continue;
    pair(
      m,
      same,
      "montant_incoherent",
      `Mission ${money(m.amount)} contre charge ${money(same.amount)} sur ${ym(
        m.year,
        m.month,
      )} : montants incohérents pour la même partie.`,
    );
  }

  for (const m of missions) {
    if (usedMissions.has(m.id)) continue;
    rows.push({
      id: `mission-${m.id}`,
      kind: "mission_sans_charge",
      status: STATUS_BY_KIND.mission_sans_charge,
      missionId: m.id,
      chargeId: null,
      missionAmount: m.amount,
      chargeAmount: 0,
      gap: m.amount,
      label: `${m.sstName}${m.clientName ? ` / ${m.clientName}` : ""} — ${m.label}`,
      message: `Mission de ${money(m.amount)} du ${m.date} sans charge de sous-traitance correspondante.`,
    });
  }
  for (const c of charges) {
    if (usedCharges.has(c.id)) continue;
    rows.push({
      id: `charge-${c.id}`,
      kind: "charge_sans_mission",
      status: STATUS_BY_KIND.charge_sans_mission,
      missionId: null,
      chargeId: c.id,
      missionAmount: 0,
      chargeAmount: c.amount,
      gap: c.amount,
      label: `${c.designation} — ${ym(c.year, c.month)}`,
      message: `Charge de sous-traitance de ${money(c.amount)} en ${ym(
        c.year,
        c.month,
      )} sans mission saisie : coût réel non suivi dans le Journal SST.`,
    });
  }

  const matched = rows.filter((r) => r.missionId !== null && r.chargeId !== null);
  const matchedMissionTotal = matched.reduce((s, r) => s + r.missionAmount, 0);
  const matchedChargeTotal = matched.reduce((s, r) => s + r.chargeAmount, 0);
  const unmatchedMissionTotal = rows
    .filter((r) => r.kind === "mission_sans_charge")
    .reduce((s, r) => s + r.missionAmount, 0);
  const unmatchedChargeTotal = rows
    .filter((r) => r.kind === "charge_sans_mission" || r.kind === "doublon")
    .reduce((s, r) => s + r.chargeAmount, 0);

  const periode =
    period === "exercice_complet" ? `exercice ${year} complet` : `exercice ${year} à date`;
  const status =
    rows.length === 0
      ? "certifie"
      : worstIntegrity(rows.map((r) => r.status));
  const gap = missionTotal - chargeTotal;

  const message =
    rows.length === 0
      ? `Aucune mission ni charge de sous-traitance sur le périmètre (${periode}).`
      : status === "certifie"
        ? `Rapprochement complet : ${money(missionTotal)} de missions et ${money(
            chargeTotal,
          )} de charges, toutes les lignes ont une contrepartie.`
        : `Écart de ${money(Math.abs(gap))} entre missions (${money(missionTotal)}) et charges (${money(
            chargeTotal,
          )}) : ${money(unmatchedMissionTotal)} de missions sans charge et ${money(
            unmatchedChargeTotal,
          )} de charges sans mission restent non rapprochés.`;

  return {
    rows,
    missionTotal,
    chargeTotal,
    missionCount: missions.length,
    chargeCount: charges.length,
    matchedMissionTotal,
    matchedChargeTotal,
    unmatchedMissionTotal,
    unmatchedChargeTotal,
    gap,
    status,
    periode,
    message,
  };
}

/** Conversion d'une mission complète en référence de rapprochement. */
export function missionRef(params: {
  id: string;
  mission_date: string;
  invoiced_amount: number | null;
  agreed_price: number | null;
  service_requested: string;
  prestation?: string | null;
  sstName: string;
  clientName: string | null;
}): SstMissionRef {
  const d = params.mission_date.slice(0, 10);
  return {
    id: params.id,
    date: d,
    year: Number(d.slice(0, 4)),
    month: Number(d.slice(5, 7)),
    amount: Number(params.invoiced_amount ?? params.agreed_price ?? 0),
    sstName: params.sstName,
    clientName: params.clientName,
    label: params.prestation || params.service_requested,
  };
}
