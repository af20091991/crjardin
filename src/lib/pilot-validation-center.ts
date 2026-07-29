// Centre de validation unique (Pilot Pro V1.1).
//
// Un seul écran regroupe tout ce qui attend une décision humaine :
//  - lignes financières incertaines (pilot_ca_entries),
//  - contrats CEEV non rattachés à un client (ceev_contracts),
//  - libellés de sous-traitance non confirmés (charges + pilot_sst_label_map).
//
// Aucune nouvelle source de vérité : le centre lit les moteurs existants et
// leur renvoie les décisions. La mémoire des validations est elle aussi lue
// dans les tables existantes (catégories déjà validées, correspondances SST).

import { supabase } from "@/integrations/supabase/client";
import {
  caEntryConfidence,
  ceevConfidence,
  sstLineConfidence,
  type ConfidenceScore,
} from "@/lib/pilot-confidence";
import type { PendingValidationLine } from "@/lib/pilot-validation";
import type { CeevContract } from "@/lib/ceev";
import type { MappedSstChargeLine } from "@/lib/sst-provider-map";

export type ValidationDomain = "ca" | "ceev" | "sst";

export const DOMAIN_LABELS: Record<ValidationDomain, string> = {
  ca: "Lignes financières",
  ceev: "Contrats CEEV",
  sst: "Sous-traitance",
};

export interface ValidationItem {
  id: string;
  domain: ValidationDomain;
  title: string;
  detail: string;
  amount: number | null;
  year: number | null;
  confidence: ConfidenceScore;
  /** Proposition issue de la mémoire des validations, jamais appliquée seule. */
  suggestion: string | null;
  to: string;
}

// ---------------- Mémoire des validations ----------------

export function normalizeDesignation(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface CategoryMemoryEntry {
  charge_class: string;
  charge_category: string;
  occurrences: number;
}

/**
 * Mémoire : catégories déjà retenues par l'utilisateur sur des libellés
 * identiques (lignes validées). Sert uniquement à proposer, jamais à décider.
 */
export async function loadCategoryMemory(): Promise<Map<string, CategoryMemoryEntry>> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("designation,charge_class,charge_category")
    .eq("validation_status", "valide")
    .not("charge_category", "is", null)
    .limit(5000);
  if (error) throw error;

  const map = new Map<string, CategoryMemoryEntry>();
  for (const row of (data ?? []) as Array<{
    designation: string | null;
    charge_class: string | null;
    charge_category: string | null;
  }>) {
    const key = normalizeDesignation(row.designation);
    if (!key || !row.charge_category || row.charge_category === "À classer") continue;
    const cur = map.get(key);
    if (cur) {
      cur.occurrences += 1;
      continue;
    }
    map.set(key, {
      charge_class: row.charge_class ?? "a_classer",
      charge_category: row.charge_category,
      occurrences: 1,
    });
  }
  return map;
}

export function memorySuggestion(
  designation: string | null,
  memory: Map<string, CategoryMemoryEntry>,
): string | null {
  const hit = memory.get(normalizeDesignation(designation));
  if (!hit) return null;
  return `Déjà classé ${hit.occurrences} fois en « ${hit.charge_category} »`;
}

// ---------------- Construction des éléments à valider ----------------

export function buildValidationItems(params: {
  caLines: PendingValidationLine[];
  contracts: CeevContract[];
  sstLines: MappedSstChargeLine[];
  memory?: Map<string, CategoryMemoryEntry>;
}): ValidationItem[] {
  const { caLines, contracts, sstLines, memory } = params;
  const items: ValidationItem[] = [];

  for (const l of caLines) {
    items.push({
      id: `ca:${l.id}`,
      domain: "ca",
      title: l.designation || "Ligne sans libellé",
      detail: `${String(l.month).padStart(2, "0")}/${l.year} — ${l.charge_category || "À classer"}`,
      amount: l.amount_ht,
      year: l.year,
      confidence: caEntryConfidence(l),
      suggestion: memory ? memorySuggestion(l.designation, memory) : null,
      to: "/pilot/validation",
    });
  }

  for (const c of contracts) {
    if (c.validation_status === "valide" && c.client_id) continue;
    items.push({
      id: `ceev:${c.id}`,
      domain: "ceev",
      title: c.label || c.raw_label,
      detail: `Contrat ${c.year} — ${c.client_name ? `client ${c.client_name}` : "client non rattaché"}`,
      amount: c.pv_ht,
      year: c.year,
      confidence: ceevConfidence(c),
      suggestion: null,
      to: "/pilot/ceev",
    });
  }

  for (const s of sstLines) {
    if (s.confirmed && !s.duplicateOfMission) continue;
    items.push({
      id: `sst:${s.id}`,
      domain: "sst",
      title: s.designation,
      detail: `${String(s.month).padStart(2, "0")}/${s.year} — prestataire détecté : ${s.displayProvider}${
        s.duplicateOfMission ? " — déjà couvert par une mission" : ""
      }`,
      amount: s.amount,
      year: s.year,
      confidence: sstLineConfidence(s),
      suggestion: null,
      to: "/journal-sst",
    });
  }

  return items.sort((a, b) => a.confidence.score - b.confidence.score);
}

export interface ValidationSummary {
  total: number;
  montant: number;
  byDomain: Record<ValidationDomain, number>;
  incertain: number;
  aVerifier: number;
  /** Part des éléments jugés fiables sur l'ensemble analysé. */
  coveragePct: number;
}

export function validationSummary(items: ValidationItem[], analysed: number): ValidationSummary {
  const byDomain: Record<ValidationDomain, number> = { ca: 0, ceev: 0, sst: 0 };
  let montant = 0;
  let incertain = 0;
  let aVerifier = 0;
  for (const i of items) {
    byDomain[i.domain] += 1;
    montant += Math.abs(i.amount ?? 0);
    if (i.confidence.level === "incertain") incertain += 1;
    if (i.confidence.level === "a_verifier") aVerifier += 1;
  }
  const coveragePct = analysed > 0 ? Math.max(0, ((analysed - items.length) / analysed) * 100) : 0;
  return { total: items.length, montant, byDomain, incertain, aVerifier, coveragePct };
}