// Pré-devis — préparation pure des écritures catalogue (aucun accès réseau ici).
import type { CatalogueSource } from "./predevis-catalogue-normalize";
import { normText } from "./predevis-catalogue-normalize";
import type { ImportPlan } from "./predevis-catalogue-import";

export type ProductRow = {
  norm_code: string;
  code: string;
  designation: string;
  norm_designation: string;
  unit: string | null;
  family: string | null;
  description: string | null;
};

export type OfferRow = {
  norm_code: string;
  supplier_id: string | null;
  source: CatalogueSource;
  pau_ht: number | null;
  pau_raw: string | null;
};

/** Fournisseurs à créer : seulement ceux que l'utilisateur a confirmés. */
export function suppliersToCreate(
  unknownNames: string[],
  confirmed: string[],
): Array<{ name: string; norm_name: string }> {
  const allowed = new Set(confirmed.map((n) => normText(n)));
  const out = new Map<string, { name: string; norm_name: string }>();
  for (const name of unknownNames) {
    const key = normText(name);
    if (allowed.has(key) && !out.has(key)) out.set(key, { name, norm_name: key });
  }
  return [...out.values()];
}

/** Transforme le plan en lignes prêtes à écrire. Les offres sans fournisseur connu gardent supplier_id = null. */
export function toWriteRows(
  plan: ImportPlan,
  supplierIdByNormName: Map<string, string>,
): { products: ProductRow[]; offers: OfferRow[] } {
  const products: ProductRow[] = plan.products.map((p) => ({ ...p }));
  const offers: OfferRow[] = plan.offers.map((o) => ({
    norm_code: o.norm_code,
    supplier_id: o.supplier_name
      ? (supplierIdByNormName.get(normText(o.supplier_name)) ?? null)
      : null,
    source: o.source,
    pau_ht: o.pau_ht,
    pau_raw: o.pau_raw,
  }));
  return { products, offers };
}

/**
 * Prix retenu pour un produit × fournisseur : le plus haut entre les sources (règle validée).
 * Une valeur absente ne gagne jamais.
 */
export function effectivePau(offers: Array<{ pau_ht: number | null; source: CatalogueSource }>): {
  value: number | null;
  source: CatalogueSource | null;
} {
  let best: { value: number | null; source: CatalogueSource | null } = {
    value: null,
    source: null,
  };
  for (const o of offers) {
    if (o.pau_ht == null) continue;
    if (best.value == null || o.pau_ht > best.value) best = { value: o.pau_ht, source: o.source };
  }
  return best;
}
