// Pré-devis — construction pure du catalogue à partir des lignes lues (Excel « Produits » ou export Henrri).
// Aucune écriture ici : le résultat est un plan, appliqué ensuite par la couche données.

import {
  type CatalogueSource,
  findDuplicateCodes,
  isCatalogueExcluded,
  normCode,
  normDesignation,
  normText,
  normUnit,
  parsePrice,
  resolvePriceConflict,
} from "./predevis-catalogue-normalize";

export type RawRow = Record<string, unknown>;

export type PlannedProduct = {
  norm_code: string;
  code: string;
  designation: string;
  norm_designation: string;
  unit: string | null;
  family: string | null;
  description: string | null;
};

export type PlannedOffer = {
  norm_code: string;
  supplier_name: string | null; // null = fournisseur non précisé (export Henrri)
  source: CatalogueSource;
  pau_ht: number | null;
  pau_raw: string | null;
};

export type ExistingOffer = {
  norm_code: string;
  supplier_name: string | null;
  source: CatalogueSource;
  pau_ht: number | null;
};

export type ImportConflict = {
  norm_code: string;
  supplier_name: string | null;
  kept: { source: CatalogueSource; value: number | null };
  other: { source: CatalogueSource; value: number | null };
};

export type ImportReport = {
  source: CatalogueSource;
  rows_read: number;
  products: number;
  excluded: Array<{ code: string; designation: string; reason: "service_ou_mo" | "sans_reference" | "sans_designation" }>;
  duplicates: string[];
  missing_price: Array<{ norm_code: string; designation: string; pau_raw: string | null }>;
  unknown_suppliers: string[];
  conflicts: ImportConflict[];
};

export type ImportPlan = {
  products: PlannedProduct[];
  offers: PlannedOffer[];
  report: ImportReport;
};

// Libellés d'en-tête attendus, par source (tolérants : accents et casse ignorés).
const HEADERS = {
  excel: { code: "Code produit", designation: "Désignation", pau: "PAU HT", description: "Description", supplier: "Fournisseur 1" },
  henrri: { code: "Référence", designation: "Désignation", pau: "P.A HT", family: "Famille", unit: "Unité" },
} as const;

function cell(row: RawRow, label: string | undefined): unknown {
  if (!label) return undefined;
  const target = normText(label);
  for (const key of Object.keys(row)) {
    if (normText(key) === target) return row[key];
  }
  return undefined;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/** Découpe « SJ34, P-C, Ruiz » en noms distincts. */
export function splitSupplierNames(raw: unknown): string[] {
  const names = text(raw)
    .split(/[,;/]| et /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(names)];
}

export function buildCatalogueImport(args: {
  source: CatalogueSource;
  rows: RawRow[];
  knownSuppliers: Set<string>; // noms normalisés (normText) des fournisseurs connus, alias compris
  existingOffers?: ExistingOffer[];
}): ImportPlan {
  const { source, rows, knownSuppliers, existingOffers = [] } = args;
  const h = HEADERS[source];
  const henrri = source === "henrri";
  const headers = h as Record<string, string | undefined>;

  const excluded: ImportReport["excluded"] = [];
  const candidates: Array<{ code: string; norm: string; designation: string; row: RawRow }> = [];

  for (const row of rows) {
    const code = text(cell(row, h.code));
    const designation = text(cell(row, h.designation));
    const family = henrri ? text(cell(row, headers.family)) : "";

    // En-têtes de section répétés dans l'Excel (« Code produit » en colonne code).
    if (normText(code) === normText(h.code)) continue;
    if (!code && !designation) continue;

    if (isCatalogueExcluded({ family, designation, code })) {
      excluded.push({ code, designation, reason: "service_ou_mo" });
      continue;
    }
    const norm = normCode(code);
    if (!norm) {
      excluded.push({ code, designation, reason: "sans_reference" });
      continue;
    }
    if (!designation) {
      excluded.push({ code, designation, reason: "sans_designation" });
      continue;
    }
    candidates.push({ code, norm, designation, row });
  }

  // Doublons de référence : à trancher par l'utilisateur, jamais écrasés silencieusement.
  const duplicates = findDuplicateCodes(candidates.map((c) => c.code));
  const dupSet = new Set(duplicates);

  const products: PlannedProduct[] = [];
  const offers: PlannedOffer[] = [];
  const missing_price: ImportReport["missing_price"] = [];
  const unknown = new Set<string>();

  for (const c of candidates) {
    if (dupSet.has(c.norm)) continue;

    products.push({
      norm_code: c.norm,
      code: c.code,
      designation: c.designation,
      norm_designation: normDesignation(c.designation),
      unit: henrri ? normUnit(cell(c.row, headers.unit)) : null,
      family: henrri ? text(cell(c.row, headers.family)) || null : null,
      description: source === "excel" ? text(cell(c.row, HEADERS.excel.description)) || null : null,
    });

    const price = parsePrice(cell(c.row, h.pau));
    if (price.status !== "ok") {
      missing_price.push({ norm_code: c.norm, designation: c.designation, pau_raw: price.raw });
    }

    let suppliers: string[];
    if (!henrri) {
      suppliers = splitSupplierNames(cell(c.row, HEADERS.excel.supplier));
      for (const name of suppliers) {
        if (!knownSuppliers.has(normText(name))) unknown.add(name);
      }
    } else {
      // Henrri ne donne pas le fournisseur : rattaché seulement si l'Excel en indique un pour ce produit.
      suppliers = [
        ...new Set(
          existingOffers
            .filter((o) => o.norm_code === c.norm && o.source === "excel" && o.supplier_name)
            .map((o) => o.supplier_name as string),
        ),
      ];
    }

    if (suppliers.length === 0) {
      offers.push({ norm_code: c.norm, supplier_name: null, source, pau_ht: price.value, pau_raw: price.raw });
    } else {
      for (const name of suppliers) {
        offers.push({ norm_code: c.norm, supplier_name: name, source, pau_ht: price.value, pau_raw: price.raw });
      }
    }
  }

  // Conflits : même produit × fournisseur, autre source, valeurs différentes → la plus haute est retenue.
  const conflicts: ImportConflict[] = [];
  for (const o of offers) {
    const other = existingOffers.find(
      (e) => e.norm_code === o.norm_code && e.supplier_name === o.supplier_name && e.source !== o.source,
    );
    if (!other) continue;
    const incoming = { value: o.pau_ht, source: o.source };
    const current = { value: other.pau_ht, source: other.source };
    const resolved = resolvePriceConflict(current, incoming);
    if (!resolved.conflict) continue;
    const keptIsIncoming = resolved.source === o.source;
    conflicts.push({
      norm_code: o.norm_code,
      supplier_name: o.supplier_name,
      kept: { source: resolved.source, value: resolved.value },
      other: keptIsIncoming ? current : incoming,
    });
  }

  return {
    products,
    offers,
    report: {
      source,
      rows_read: rows.length,
      products: products.length,
      excluded,
      duplicates,
      missing_price,
      unknown_suppliers: [...unknown],
      conflicts,
    },
  };
}
