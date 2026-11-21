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

/** Libellé contenant « SST » comme mot (« SST Dupont », « Facture SST Dupont », « Dupont-SST »). */
export function hasSstPrefix(label: string | null | undefined): boolean {
  return /(^|[^a-z0-9À-ÿ])sst(?![a-z0-9À-ÿ])/i.test(label ?? "");
}

/** « SST » ou formulations équivalentes (« Sous-traitance X », « Ss-traitance X »). */
export function mentionsSst(label: string | null | undefined): boolean {
  return hasSstPrefix(label) || /sous[-\s]?trait|\bss[-\s]?trait/i.test(label ?? "");
}

/** Classements explicites qu'un classement automatique ne remplace jamais. */
const PROTECTED_CATEGORIES = new Set(["SST", "Charge fixe", "Rémunération", "Investissement"]);

/**
 * Une charge doit-elle être classée « SST » ? Vrai si son libellé mentionne SST, sauf charge
 * fixe, rémunération ou investissement. Un classement générique (Charge chantier, Charge
 * variable, À classer…) est remplacé : la mention SST fait foi.
 */
export function shouldAutoClassifySst(row: {
  designation: string | null | undefined;
  charge_category?: string | null;
  charge_class?: string | null;
  is_fixed?: boolean | null;
  is_investment?: boolean | null;
}): boolean {
  if (row.is_fixed || row.is_investment || row.charge_class === "fixe") return false;
  if (!mentionsSst(row.designation)) return false;
  return !PROTECTED_CATEGORIES.has((row.charge_category ?? "").trim());
}

export interface SstChargeMissionLink {
  missionId: string | null;
  /** Conservé pour compatibilité : une charge n'est jamais exclue, même si sa mission est déjà rattachée. */
  duplicate: boolean;
}

export interface SstChargeInput {
  id: string;
  year: number;
  month: number;
  amount: number;
  /** Mission choisie à la main (rattachement explicite) : prime sur la correspondance automatique. */
  manualMissionId?: string | null;
}

function missionYearMonth(m: SubcontractorMission): { year: number; month: number } {
  return { year: Number(m.mission_date.slice(0, 4)), month: Number(m.mission_date.slice(5, 7)) };
}

function missionCostOf(m: SubcontractorMission): number {
  return Number(m.invoiced_amount ?? m.agreed_price ?? 0);
}

/**
 * Règle de rapprochement : une charge SST inscrite dans le Chiffre d'affaires est toujours
 * comptée. Elle se rattache à une mission SST du même mois (montant le plus proche, une mission
 * n'accueille qu'une charge). Le montant n'est pas une condition : une charge sans mission
 * reste comptée et apparaît comme « à rattacher ». Lecture seule.
 */
export function linkChargesToMissions(
  charges: SstChargeInput[],
  missions: SubcontractorMission[],
): Map<string, SstChargeMissionLink> {
  const result = new Map<string, SstChargeMissionLink>();
  const used = new Set<string>();
  for (const c of charges) {
    if (!c.manualMissionId) continue;
    used.add(c.manualMissionId);
    result.set(c.id, { missionId: c.manualMissionId, duplicate: false });
  }
  const automatic = charges
    .filter((c) => !c.manualMissionId)
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  for (const c of automatic) {
    const candidates = missions.filter((m) => {
      if (m.archived_at || used.has(m.id)) return false;
      const ym = missionYearMonth(m);
      return ym.year === c.year && ym.month === c.month;
    });
    if (candidates.length === 0) {
      result.set(c.id, { missionId: null, duplicate: false });
      continue;
    }
    const best = candidates.reduce((b, m) =>
      Math.abs(missionCostOf(m) - c.amount) < Math.abs(missionCostOf(b) - c.amount) ? m : b,
    );
    used.add(best.id);
    result.set(c.id, { missionId: best.id, duplicate: false });
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
  /** Mission SST du même mois à laquelle la charge est rattachée (null si aucune). */
  missionId: string | null;
  /** true si la charge est rattachée à une mission. La charge reste comptée dans tous les cas. */
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

  const links = linkChargesToMissions(
    chargeRows.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      amount: r.amount_ht,
      manualMissionId: r.subcontractor_mission_id ?? null,
    })),
    missions,
  );

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
        missionId: links.get(r.id)?.missionId ?? null,
        duplicateOfMission: Boolean(links.get(r.id)?.missionId),
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
