// Pré-devis — rattachement pur d'une ligne de devis au catalogue.
// Règles : code exact d'abord, puis désignation exacte, puis candidats (jamais de choix automatique).
// Le fournisseur n'est jamais choisi ici : il est proposé avec son prix, c'est l'utilisateur qui tranche.
import {
  normCode,
  normDesignation,
  normText,
  type CatalogueSource,
} from "./predevis-catalogue-normalize";
import { effectivePau } from "./predevis-catalogue-write";

export type CatalogueProduct = {
  id: string;
  norm_code: string;
  code: string;
  designation: string;
  norm_designation: string;
  unit: string | null;
};

export type CatalogueOffer = {
  product_id: string;
  supplier_id: string | null; // null = fournisseur non précisé
  supplier_name: string | null;
  source: CatalogueSource;
  pau_ht: number | null;
};

export type SupplierOption = {
  supplier_id: string | null;
  supplier_name: string | null; // null = non précisé
  pau_ht: number | null; // null = prix d'achat manquant (jamais estimé)
  source: CatalogueSource | null;
};

export type MatchCandidate = {
  productId: string;
  code: string;
  designation: string;
  score: number;
};

export type MatchResult = {
  status: "code" | "designation" | "a_confirmer" | "aucun";
  productId: string | null;
  candidates: MatchCandidate[];
  reason: string;
};

const STOP = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "en",
  "a",
  "au",
  "aux",
  "d",
  "l",
]);
const CANDIDATE_MIN = 0.5;

function tokens(designation: string): Set<string> {
  return new Set(
    normText(designation)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function matchQuoteRow(
  row: { ref: string | null; designation: string },
  products: CatalogueProduct[],
): MatchResult {
  const code = normCode(row.ref);
  if (code) {
    const byCode = products.filter((p) => p.norm_code === code);
    if (byCode.length === 1) {
      return {
        status: "code",
        productId: byCode[0].id,
        candidates: [],
        reason: "Référence identique au catalogue.",
      };
    }
    if (byCode.length > 1) {
      return {
        status: "a_confirmer",
        productId: null,
        candidates: byCode.map((p) => ({
          productId: p.id,
          code: p.code,
          designation: p.designation,
          score: 1,
        })),
        reason: "Référence présente plusieurs fois : à choisir.",
      };
    }
  }

  const desig = normDesignation(row.designation);
  const byDesig = products.filter((p) => p.norm_designation === desig);
  if (byDesig.length === 1) {
    return {
      status: "designation",
      productId: byDesig[0].id,
      candidates: [],
      reason: "Désignation identique au catalogue.",
    };
  }
  if (byDesig.length > 1) {
    return {
      status: "a_confirmer",
      productId: null,
      candidates: byDesig.map((p) => ({
        productId: p.id,
        code: p.code,
        designation: p.designation,
        score: 1,
      })),
      reason: "Désignation présente plusieurs fois : à choisir.",
    };
  }

  const wanted = tokens(row.designation);
  const candidates = products
    .map((p) => ({
      productId: p.id,
      code: p.code,
      designation: p.designation,
      score: jaccard(wanted, tokens(p.designation)),
    }))
    .filter((c) => c.score >= CANDIDATE_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (candidates.length > 0) {
    return {
      status: "a_confirmer",
      productId: null,
      candidates,
      reason: "Aucune correspondance exacte : à confirmer.",
    };
  }
  return {
    status: "aucun",
    productId: null,
    candidates: [],
    reason: "Aucun produit au catalogue : saisie manuelle du prix.",
  };
}

/** Fournisseurs proposés pour un produit, avec le prix retenu pour chacun (le plus haut entre sources). */
export function supplierOptions(productId: string, offers: CatalogueOffer[]): SupplierOption[] {
  const groups = new Map<string, CatalogueOffer[]>();
  for (const o of offers) {
    if (o.product_id !== productId) continue;
    const key = o.supplier_id ?? "__non_precise__";
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return [...groups.values()].map((list) => {
    const best = effectivePau(list);
    const first = list[0];
    return {
      supplier_id: first.supplier_id,
      supplier_name: first.supplier_name,
      pau_ht: best.value,
      source: best.source,
    };
  });
}
