// ---------------------------------------------------------------------------
// VALIDATION DE LA NATURE D'UNE LIGNE FINANCIÈRE (outil unique et simple)
//
// Une seule question posée à l'utilisateur, ligne par ligne :
//   « Cette ligne est-elle une Vente, une Charge variable ou une Charge fixe ? »
//
// Règles absolues :
//   • le montant, la date et le libellé d'origine ne sont JAMAIS modifiés ;
//   • aucun classement automatique : seule la décision humaine écrit ;
//   • chaque décision est historisée dans pilot_edit_log (avant / après) ;
//   • un investissement qualifié n'est pas une charge « à classer ».
// ---------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

export type LineNature = "vente" | "variable" | "fixe";

export const NATURE_LABELS: Record<LineNature, string> = {
  vente: "Vente",
  variable: "Charge variable",
  fixe: "Charge fixe",
};

export interface NatureLineRaw {
  id: string;
  year: number;
  month: number;
  designation: string | null;
  amount_ht: number | null;
  kind: string | null;
  charge_class: string | null;
  is_investment?: boolean | null;
}

export interface NatureLine {
  id: string;
  year: number;
  month: number;
  designation: string;
  amount: number;
  kind: string;
  currentClass: string;
  /** Encart de la page Chiffre d'affaires où la ligne apparaît aujourd'hui. */
  placement: string;
}

/** Emplacement lisible de la ligne dans la page Chiffre d'affaires. */
export function placementOf(row: { kind?: string | null }): string {
  return row.kind === "vente"
    ? "Chiffre d'affaires → Ventes"
    : row.kind === "remuneration"
      ? "Chiffre d'affaires → Rémunération"
      : "Chiffre d'affaires → Charges";
}

/** Une ligne appelle-t-elle une décision de nature ? (règle pure, testable) */
export function needsNatureDecision(row: {
  kind?: string | null;
  charge_class?: string | null;
  is_investment?: boolean | null;
}): boolean {
  if (row.is_investment) return false;
  if (row.kind !== "charge") return false;
  return !row.charge_class || row.charge_class === "a_classer";
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

export async function listLinesToValidate(limit = 500): Promise<NatureLine[]> {
  const { data, error } = await db
    .from("pilot_ca_entries")
    .select("id,year,month,designation,amount_ht,kind,charge_class,is_investment")
    .eq("kind", "charge")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(2000);
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
      currentClass: r.charge_class || "a_classer",
      placement: placementOf(r),
    }));
}

/** Écrit la décision humaine et l'historise. Montant / libellé intacts. */
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
    ...(patch.kind !== row.kind
      ? [{ field: "kind", before: row.kind, after: patch.kind }]
      : []),
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
