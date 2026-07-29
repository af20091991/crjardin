// Validation manuelle des lignes financières (pilot_ca_entries).
// STRUCTURE UNIQUEMENT : aucune ligne n'est classée automatiquement, aucune
// donnée historique n'est modifiée. L'utilisateur validera plus tard depuis
// l'interface les lignes « à classer » ou de catégorie incertaine.
import { supabase } from "@/integrations/supabase/client";

export type ValidationStatus = "a_valider" | "valide" | "a_revoir";

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  a_valider: "À valider",
  valide: "Validée",
  a_revoir: "À revoir",
};

/** Motifs pour lesquels une ligne appelle une décision métier. */
export type ValidationReason = "charge_a_classer" | "categorie_incertaine" | "client_non_identifie";

export const VALIDATION_REASON_LABELS: Record<ValidationReason, string> = {
  charge_a_classer: "Charge à classer (fixe / variable)",
  categorie_incertaine: "Catégorie incertaine",
  client_non_identifie: "Client non rattaché",
};

export interface PendingValidationLine {
  id: string;
  year: number;
  month: number;
  kind: string;
  designation: string | null;
  amount_ht: number;
  charge_class: string | null;
  charge_category: string | null;
  match_status: string | null;
  validation_status: ValidationStatus;
  validation_note: string | null;
  reasons: ValidationReason[];
}

type Raw = Omit<PendingValidationLine, "reasons" | "amount_ht"> & { amount_ht: number | null };

function reasonsFor(r: Raw): ValidationReason[] {
  const out: ValidationReason[] = [];
  if (r.kind === "charge" && (!r.charge_class || r.charge_class === "a_classer")) {
    out.push("charge_a_classer");
  }
  if (!r.charge_category || r.charge_category === "À classer") out.push("categorie_incertaine");
  if (r.match_status === "non_identifie") out.push("client_non_identifie");
  return out;
}

/** Lignes en attente d'une décision utilisateur. Lecture seule. */
export async function listPendingValidation(limit = 500): Promise<PendingValidationLine[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select(
      "id,year,month,kind,designation,amount_ht,charge_class,charge_category,match_status,validation_status,validation_note",
    )
    .neq("validation_status", "valide")
    .order("year", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[])
    .map((r) => ({ ...r, amount_ht: Number(r.amount_ht) || 0, reasons: reasonsFor(r) }))
    .filter((r) => r.reasons.length > 0);
}

/** Enregistre la décision de l'utilisateur sur une ligne (montant jamais touché). */
export async function setValidation(
  id: string,
  status: ValidationStatus,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("pilot_ca_entries")
    .update({
      validation_status: status,
      validation_note: note ?? null,
      validated_at: status === "valide" ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}