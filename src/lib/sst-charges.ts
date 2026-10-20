// Sous-traitance déjà présente dans les charges (pilot_ca_entries, kind = 'charge').
// AUCUNE donnée n'est créée ni modifiée : lecture et analyse seulement.
// Ces lignes sont la seule trace réelle de sous-traitance tant qu'aucune mission
// n'est saisie dans `subcontractor_missions`.
import type { ChargeRow } from "@/lib/pilot-charges";
import type { SubcontractorMission } from "@/lib/subcontractors";

// Marqueurs de sous-traitance rencontrés dans les libellés importés.
// « ss-trait » / « ss trait » sont ajoutés sur cause démontrée : la charge
// « Ss-traitance d'Aboville » (278,55 € — 02/2026) échappait à la détection et
// n'apparaissait donc ni dans le Journal SST ni dans le rapprochement.
const SST_MARKERS = ["sous-trait", "sous trait", "soustrait", "ss-trait", "ss trait", "sst"];

export function isSubcontractingLabel(label: string | null): boolean {
  const l = (label ?? "").toLowerCase();
  return SST_MARKERS.some((m) => l.includes(m));
}

/** Libellé commençant par « SST » (préfixe de classement automatique des charges). */
export function hasSstPrefix(label: string | null | undefined): boolean {
  return /^\s*sst(?![a-z0-9À-ÿ])/i.test(label ?? "");
}

/** Catégories qu'un classement automatique peut remplacer : jamais un choix explicite. */
const AUTO_CLASSIFIABLE = new Set(["", "À classer", "a_classer", "Charge variable"]);

/**
 * Une charge doit-elle être classée automatiquement « SST » ? Vrai si son libellé commence
 * par « SST » et qu'elle n'a pas déjà un classement explicite (fixe, investissement, SST…).
 */
export function shouldAutoClassifySst(row: {
  designation: string | null | undefined;
  charge_category?: string | null;
  is_fixed?: boolean | null;
  is_investment?: boolean | null;
}): boolean {
  if (row.is_fixed || row.is_investment) return false;
  if (!hasSstPrefix(row.designation)) return false;
  return AUTO_CLASSIFIABLE.has((row.charge_category ?? "").trim());
}

export interface SstChargeMissionLink {
  missionId: string | null;
  /** true si une autre charge a déjà été rapprochée de la même mission (ou même dépense). */
  duplicate: boolean;
}

/**
 * Rapproche les charges SST des missions déjà saisies (même mois, même montant, à 0,01 €).
 * Une mission n'est rattachée qu'à UNE charge ; toute autre charge identique est signalée
 * comme doublon. Lecture seule : rien n'est modifié.
 */
export function linkChargesToMissions(
  charges: Array<{ id: string; year: number; month: number; amount: number }>,
  missions: SubcontractorMission[],
): Map<string, SstChargeMissionLink> {
  const result = new Map<string, SstChargeMissionLink>();
  const usedMissions = new Set<string>();
  const seenCharges = new Map<string, string>();
  for (const c of charges) {
    const mission = missions.find((m) => {
      if (m.archived_at || usedMissions.has(m.id)) return false;
      const d = new Date(m.mission_date);
      if (d.getFullYear() !== c.year || d.getMonth() + 1 !== c.month) return false;
      const cost = Number(m.invoiced_amount ?? m.agreed_price ?? 0);
      return cost > 0 && Math.abs(cost - c.amount) < 0.01;
    });
    const key = `${c.year}-${c.month}-${c.amount.toFixed(2)}`;
    if (mission) {
      usedMissions.add(mission.id);
      if (!seenCharges.has(key)) seenCharges.set(key, c.id);
      result.set(c.id, { missionId: mission.id, duplicate: false });
      continue;
    }
    // Même mois et même montant qu'une autre charge SST : doublon probable.
    result.set(c.id, { missionId: null, duplicate: seenCharges.has(key) });
    if (!seenCharges.has(key)) seenCharges.set(key, c.id);
  }
  return result;
}

export interface SstChargeLine {
  id: string;
  year: number;
  month: number;
  designation: string;
  amount: number;
  /** Nom du sous-traitant déduit du libellé — à confirmer par l'utilisateur. */
  provider: string;
  /** Client reconnu dans le libellé, sinon null (jamais deviné). */
  clientName: string | null;
  /** true si une mission SST couvre déjà cette dépense → exclue des totaux. */
  duplicateOfMission: boolean;
}

/** Retire les marqueurs et l'année du libellé pour isoler le nom du prestataire. */
function cleanLabel(designation: string): string {
  return designation
    .replace(/sous[-\s]?trait\w*/gi, " ")
    .replace(/\bss[-\s]?trait\w*/gi, " ")
    .replace(/\bsst\b/gi, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Protection anti double comptage : une charge est considérée déjà suivie
 * si une mission SST non archivée porte le même mois et le même montant.
 */
function coveredByMission(row: ChargeRow, missions: SubcontractorMission[]): boolean {
  return missions.some((m) => {
    const d = new Date(m.mission_date);
    if (d.getFullYear() !== row.year || d.getMonth() + 1 !== row.month) return false;
    const cost = Number(m.invoiced_amount ?? m.agreed_price ?? 0);
    return cost > 0 && Math.abs(cost - row.amount_ht) < 0.01;
  });
}

export function sstChargeLines(params: {
  chargeRows: ChargeRow[];
  missions?: SubcontractorMission[];
  clients?: { id: string; name: string }[];
  year?: number | "all";
}): SstChargeLine[] {
  const { chargeRows, missions = [], clients = [], year = "all" } = params;
  const clientTokens = clients
    .map((c) => ({ name: c.name, key: normalize(c.name) }))
    .filter((c) => c.key.length >= 4);

  return chargeRows
    .filter(
      (r) =>
        !r.is_investment && (isSubcontractingLabel(r.designation) || r.charge_category === "SST"),
    )
    .filter((r) => (year === "all" ? true : r.year === year))
    .map((r) => {
      const designation = r.designation ?? "";
      const rest = cleanLabel(designation);
      const hay = normalize(rest);
      const matched = clientTokens.find((c) =>
        c.key.split(/\s+/).some((w) => w.length >= 4 && hay.includes(w)),
      );
      return {
        id: r.id,
        year: r.year,
        month: r.month,
        designation,
        amount: r.amount_ht,
        provider: rest || "Non identifié",
        clientName: matched?.name ?? null,
        duplicateOfMission: coveredByMission(r, missions),
      };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

export interface SstProviderStat {
  provider: string;
  lines: number;
  amount: number;
  years: number[];
  clients: string[];
}

export function sstByProvider(lines: SstChargeLine[]): SstProviderStat[] {
  const map = new Map<string, SstProviderStat>();
  for (const l of lines) {
    if (l.duplicateOfMission) continue;
    const key = l.provider;
    const g = map.get(key) ?? { provider: key, lines: 0, amount: 0, years: [], clients: [] };
    g.lines += 1;
    g.amount += l.amount;
    if (!g.years.includes(l.year)) g.years.push(l.year);
    if (l.clientName && !g.clients.includes(l.clientName)) g.clients.push(l.clientName);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface SstChargeTotals {
  lines: number;
  amount: number;
  duplicates: number;
  duplicatesAmount: number;
  /** Part de la sous-traitance dans le CA de la période, si le CA est connu. */
  shareOfCaPct: number | null;
}

export function sstChargeTotals(lines: SstChargeLine[], ca: number | null): SstChargeTotals {
  const kept = lines.filter((l) => !l.duplicateOfMission);
  const dupes = lines.filter((l) => l.duplicateOfMission);
  const amount = kept.reduce((s, l) => s + l.amount, 0);
  return {
    lines: kept.length,
    amount,
    duplicates: dupes.length,
    duplicatesAmount: dupes.reduce((s, l) => s + l.amount, 0),
    shareOfCaPct: ca && ca > 0 ? (amount / ca) * 100 : null,
  };
}
