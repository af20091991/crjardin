// ---------------------------------------------------------------------------
// VALIDATION DE LA NATURE D'UNE LIGNE FINANCIÈRE (outil unique et simple)
//
// Une seule question posée à l'utilisateur, ligne par ligne :
//   « Cette ligne est-elle une Vente, une Charge variable ou une Charge fixe ? »
//
// Le périmètre couvre les DEUX emplacements de la page Chiffre d'affaires :
//   • Encart Ventes  (kind = 'vente')  → lignes non encore validées ;
//   • Encart Charges (kind = 'charge') → lignes sans nature retenue.
//
// Règles absolues :
//   • le montant, la date, l'exercice et le libellé d'origine ne sont JAMAIS
//     modifiés ;
//   • aucun classement automatique : seule la décision humaine écrit ;
//   • une ligne reclassée est mise à jour sur place (jamais de doublon) ;
//   • chaque décision est historisée dans pilot_edit_log (avant / après) ;
//   • un investissement qualifié n'est pas une ligne « à classer » ;
//   • les seuls choix offerts sont Vente / Charge variable / Charge fixe.
// ---------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import {
  compareNatureWithExcel,
  type ExcelNatureIndex,
  type NatureComparison,
} from "@/lib/pilot-excel-nature";

const db = supabase as unknown as { from: (t: string) => any };

export type LineNature = "vente" | "variable" | "fixe";

export const NATURE_LABELS: Record<LineNature, string> = {
  vente: "Vente",
  variable: "Charge variable",
  fixe: "Charge fixe",
};

/** Les trois — et seuls — choix de l'outil. */
export const NATURE_CHOICES: LineNature[] = ["vente", "variable", "fixe"];

export interface NatureLineRaw {
  id: string;
  year: number;
  month: number;
  designation: string | null;
  amount_ht: number | null;
  kind: string | null;
  charge_class: string | null;
  is_investment?: boolean | null;
  validation_status?: string | null;
  source_file?: string | null;
  source_sheet?: string | null;
}

export type Placement = "Encart Ventes" | "Encart Charges";

export interface NatureLine {
  id: string;
  year: number;
  month: number;
  designation: string;
  amount: number;
  kind: string;
  currentClass: string;
  /** Emplacement actuel : « Encart Ventes » ou « Encart Charges ». */
  placement: Placement;
}

/** Emplacement actuel de la ligne : Ventes ou Charges, sans autre libellé. */
export function placementOf(row: { kind?: string | null }): Placement {
  return row.kind === "vente" ? "Encart Ventes" : "Encart Charges";
}

/**
 * Une ligne appelle-t-elle une décision de nature ? (règle pure, testable)
 *   • Charges : aucune nature retenue (vide ou « à classer ») ;
 *   • Ventes  : emplacement jamais confirmé (validation_status ≠ 'valide').
 * Un investissement qualifié n'est jamais interrogé.
 */
export function needsNatureDecision(row: {
  kind?: string | null;
  charge_class?: string | null;
  is_investment?: boolean | null;
  validation_status?: string | null;
  source_file?: string | null;
  source_sheet?: string | null;
}): boolean {
  if (row.is_investment) return false;
  // Lors de l'import, le bloc Excel Ventes / Charges est conservé avec sa
  // provenance. C'est déjà la réponse à la question de nature ; une catégorie
  // secondaire vide ne doit pas recréer une validation humaine.
  if (row.source_file && row.source_sheet && (row.kind === "vente" || row.kind === "charge")) {
    return false;
  }
  if (row.kind === "charge") return !row.charge_class || row.charge_class === "a_classer";
  // `kind = vente` est déjà une décision de nature. Les imports historiques
  // issus de l'Excel conservent cette preuve via source_file/source_sheet ; ils
  // ne doivent jamais être renvoyés en validation faute de catégorie annexe.
  if (row.kind === "vente") return false;
  return false;
}

/** Correctif appliqué à la ligne selon la nature retenue (aucun montant touché). */
export function naturePatch(nature: LineNature): {
  kind: string;
  charge_class: string | null;
  is_investment: boolean;
} {
  if (nature === "vente") return { kind: "vente", charge_class: null, is_investment: false };
  return { kind: "charge", charge_class: nature, is_investment: false };
}

/** Lignes à contrôler, provenant des encarts Ventes ET Charges. */
export async function listLinesToValidate(limit = 500): Promise<NatureLine[]> {
  const { data, error } = await db
    .from("pilot_ca_entries")
    .select(
      "id,year,month,designation,amount_ht,kind,charge_class,is_investment,validation_status,source_file,source_sheet",
    )
    .in("kind", ["vente", "charge"])
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(3000);
  if (error) throw error;
  return ((data ?? []) as NatureLineRaw[])
    .filter((r) => needsNatureDecision(r))
    .slice(0, limit)
    .map((r) => ({
      id: String(r.id),
      year: Number(r.year) || 0,
      month: Number(r.month) || 0,
      designation: r.designation?.trim() || "(sans libellé)",
      amount: Number(r.amount_ht) || 0,
      kind: r.kind ?? "charge",
      currentClass: r.charge_class || (r.kind === "vente" ? "—" : "a_classer"),
      placement: placementOf(r),
    }));
}

/**
 * Écrit la décision humaine et l'historise. Montant, désignation et exercice
 * intacts : la ligne existante est mise à jour sur place (aucun doublon).
 */
export async function setLineNature(row: NatureLine, nature: LineNature): Promise<void> {
  const patch = naturePatch(nature);
  const { error } = await db
    .from("pilot_ca_entries")
    .update({
      ...patch,
      validation_status: "valide",
      validated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;

  const reason = `Nature validée manuellement : ${NATURE_LABELS[nature]}`;
  const traces = [
    { field: "charge_class", before: row.currentClass, after: patch.charge_class },
    ...(patch.kind !== row.kind ? [{ field: "kind", before: row.kind, after: patch.kind }] : []),
  ];
  for (const t of traces) {
    const { error: e } = await db.from("pilot_edit_log").insert({
      entity: "pilot_ca_entries",
      entity_id: row.id,
      label: row.designation,
      field: t.field,
      before_value: t.before ?? null,
      after_value: t.after ?? null,
      reason,
    });
    if (e) throw e;
  }
}


// ---------------------------------------------------------------------------
// RAPPROCHEMENT EXCEL → PILOT PRO (ordre imposé : Excel d'abord)
//
// Le fichier Excel sert de référence pour savoir si une désignation appartient
// au bloc Ventes ou au bloc Charges. Deux cas seulement entrent dans la file :
//   • « à classer » : Pilot Pro n'a pas de nature retenue ;
//   • « conflit »   : Excel indique un bloc différent de celui de Pilot Pro.
// Une ligne conforme n'est jamais présentée. Aucune écriture automatique :
// la décision reste un clic humain sur Vente / Charge variable / Charge fixe.
// ---------------------------------------------------------------------------

export type NatureQueueReason = "conflit" | "a_classer";

export const NATURE_QUEUE_REASON_LABEL: Record<NatureQueueReason, string> = {
  conflit: "Conflit à vérifier (Pilot Pro ≠ Excel)",
  a_classer: "Nature à retenir",
};

export interface NatureQueueItem {
  line: NatureLine;
  reason: NatureQueueReason;
  /** Comparaison Pilot Pro / Excel — jamais appliquée automatiquement. */
  comparison: NatureComparison;
  /** Nature proposée par Excel (Vente, ou Charge à préciser variable/fixe). */
  excelSuggestion: LineNature | null;
}

export interface NatureQueueRow extends NatureLine {
  needsDecision: boolean;
}

/**
 * File de décision : conflits Excel d'abord, puis lignes sans nature retenue.
 * Fonction PURE — aucune lecture base, aucune écriture, aucun montant touché.
 */
export function buildNatureQueue(
  rows: readonly NatureQueueRow[],
  index: ExcelNatureIndex | null,
): NatureQueueItem[] {
  const items: NatureQueueItem[] = [];
  for (const line of rows) {
    const comparison = compareNatureWithExcel(
      { kind: line.kind, designation: line.designation },
      index,
    );
    const excelSuggestion: LineNature | null =
      comparison.excel === "vente" ? "vente" : null;
    if (comparison.verdict === "conflit") {
      items.push({ line, reason: "conflit", comparison, excelSuggestion });
      continue;
    }
    if (comparison.verdict === "accord") continue;
    if (line.needsDecision) {
      items.push({ line, reason: "a_classer", comparison, excelSuggestion });
    }
  }
  // Les conflits Excel remontent en tête ; l'ordre d'origine des autres lignes
  // est conservé (tri stable) pour ne pas désorienter la lecture du tableau.
  return [
    ...items.filter((i) => i.reason === "conflit"),
    ...items.filter((i) => i.reason !== "conflit"),
  ];
}

/**
 * Toutes les lignes financières des encarts Ventes et Charges, avec le drapeau
 * « décision attendue ». Aucune ligne n'est supprimée ni modifiée en lecture.
 */
export async function listFinancialLines(limit = 3000): Promise<NatureQueueRow[]> {
  const { data, error } = await db
    .from("pilot_ca_entries")
    .select(
      "id,year,month,designation,amount_ht,kind,charge_class,is_investment,validation_status,source_file,source_sheet",
    )
    .in("kind", ["vente", "charge"])
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as NatureLineRaw[]).map((r) => ({
    id: String(r.id),
    year: Number(r.year) || 0,
    month: Number(r.month) || 0,
    designation: r.designation?.trim() || "(sans libellé)",
    amount: Number(r.amount_ht) || 0,
    kind: r.kind ?? "charge",
    currentClass: r.charge_class || (r.kind === "vente" ? "—" : "a_classer"),
    placement: placementOf(r),
    needsDecision: needsNatureDecision(r),
  }));
}
