// Pré-devis — calcul pur du coût d'une ligne, à partir de son état enregistré.
// Fourniture : coût = quantité × multiplicateur d'unité × PAU appliqué. Inconnu tant qu'un des trois manque.
// Main-d'œuvre : coût saisi à la main (0 € accepté seulement avec motif).
import type { FinanceLine } from "./predevis-finance";

export type StoredLine = {
  kind: "fourniture" | "mo";
  quantity: number | null;
  ht: number | null;
  ttc: number | null;
  pau_ht_applied: number | null;
  cost_status: "connu" | "manquant" | "manuel" | "non_applicable";
  unit_status: "ok" | "non_verifiee";
  unit_multiplier: number | null;
  manual_cost_ht: number | null;
  zero_cost_reason: "remise" | "sav" | null;
};

export function lineFinance(row: StoredLine): FinanceLine {
  let costHt: number | null = null;
  if (row.kind === "mo") {
    costHt = row.manual_cost_ht;
  } else if (row.cost_status === "connu" && row.unit_status === "ok") {
    if (row.quantity != null && row.unit_multiplier != null && row.pau_ht_applied != null) {
      costHt = Math.round(row.quantity * row.unit_multiplier * row.pau_ht_applied * 100) / 100;
    }
  }
  return { kind: row.kind, ht: row.ht, ttc: row.ttc, costHt, zeroCostReason: row.zero_cost_reason };
}

/** Multiplicateur proposé automatiquement : 1 pour une unité « pièce » du catalogue, sinon à saisir. */
export function suggestedMultiplier(catalogUnit: string | null): number | null {
  return catalogUnit === "pièce" ? 1 : null;
}

export type OfferRow = { supplier_id: string | null; source: string; pau_ht: number | null };

/**
 * Achat appliqué automatiquement à l'enregistrement, seulement si le produit n'a qu'un fournisseur :
 * le PAU est celui de l'offre (jamais estimé). Plusieurs fournisseurs : rien, le choix reste à faire.
 */
export function uniqueSupplierPurchase(
  offers: OfferRow[],
  productUnit: string | null,
): {
  supplier_id: string | null;
  pau_ht_applied: number | null;
  cost_status: "connu" | "manquant";
  unit_multiplier: number | null;
  unit_status: "ok" | "non_verifiee";
} | null {
  const groups = new Map<string, OfferRow[]>();
  for (const o of offers) {
    const key = o.supplier_id ?? "__non_precise__";
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  if (groups.size !== 1) return null;
  const [group] = [...groups.values()];
  const priced = group.map((o) => o.pau_ht).filter((v): v is number => v != null);
  const value = priced.length > 0 ? Math.max(...priced) : null;
  const multiplier = suggestedMultiplier(productUnit);
  return {
    supplier_id: group[0].supplier_id,
    pau_ht_applied: value,
    cost_status: value == null ? "manquant" : "connu",
    unit_multiplier: multiplier,
    unit_status: multiplier != null ? "ok" : "non_verifiee",
  };
}
