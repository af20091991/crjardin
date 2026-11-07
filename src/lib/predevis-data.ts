// Pré-devis — accès données (catalogue). Passe par la RLS : seuls les admins peuvent lire ou écrire.
//
// NOTE : types.ts n'est pas encore régénéré pour les tables predevis_*.
// Le client est donc utilisé sans typage strict, comme dans assistant-ap.ts.
// À retirer après la resynchronisation des types dans l'éditeur Lovable.
import { supabase } from "@/integrations/supabase/client";
import type { CatalogueSource } from "./predevis-catalogue-normalize";
import { buildCatalogueImport, type ImportPlan, type RawRow, type ExistingOffer } from "./predevis-catalogue-import";
import { suppliersToCreate, toWriteRows } from "./predevis-catalogue-write";

const db = () => supabase as unknown as { from: (table: string) => any };
const CHUNK = 500;

export async function loadSupplierIndex(): Promise<Map<string, { id: string; name: string }>> {
  const { data, error } = await db().from("predevis_suppliers").select("id, name, norm_name");
  if (error) throw error;
  return new Map((data ?? []).map((s: { id: string; name: string; norm_name: string }) => [s.norm_name, { id: s.id, name: s.name }]));
}

export async function loadExistingOffers(): Promise<ExistingOffer[]> {
  const [{ data: products, error: pe }, { data: suppliers, error: se }, { data: offers, error: oe }] = await Promise.all([
    db().from("predevis_products").select("id, norm_code"),
    db().from("predevis_suppliers").select("id, name"),
    db().from("predevis_offers").select("product_id, supplier_id, source, pau_ht"),
  ]);
  if (pe) throw pe;
  if (se) throw se;
  if (oe) throw oe;
  const codeById = new Map((products ?? []).map((p: { id: string; norm_code: string }) => [p.id, p.norm_code]));
  const nameById = new Map((suppliers ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  return (offers ?? []).map((o: { product_id: string; supplier_id: string | null; source: CatalogueSource; pau_ht: number | null }) => ({
    norm_code: codeById.get(o.product_id) ?? "",
    supplier_name: o.supplier_id ? (nameById.get(o.supplier_id) ?? null) : null,
    source: o.source,
    pau_ht: o.pau_ht,
  }));
}

/** Analyse le fichier sans rien écrire. */
export async function analyseCatalogue(source: CatalogueSource, rows: RawRow[]): Promise<ImportPlan> {
  const [suppliers, existing] = await Promise.all([loadSupplierIndex(), loadExistingOffers()]);
  return buildCatalogueImport({
    source,
    rows,
    knownSuppliers: new Set(suppliers.keys()),
    existingOffers: existing,
  });
}

/**
 * Applique l'import. Ordre : fournisseurs confirmés → journal → produits → offres.
 * Un réimport d'une source remplace ses propres prix (même produit × fournisseur × source).
 * Les autres sources ne sont pas touchées.
 */
export async function applyCatalogueImport(args: {
  plan: ImportPlan;
  fileName: string;
  confirmedSuppliers: string[];
  userId: string;
}): Promise<{ importId: string; productCount: number; offerCount: number }> {
  const { plan, fileName, confirmedSuppliers, userId } = args;
  const source = plan.report.source;

  // 1. Fournisseurs confirmés
  const toCreate = suppliersToCreate(plan.report.unknown_suppliers, confirmedSuppliers);
  if (toCreate.length > 0) {
    const { error } = await db()
      .from("predevis_suppliers")
      .upsert(toCreate.map((s) => ({ ...s, created_by: userId })), { onConflict: "norm_name", ignoreDuplicates: true });
    if (error) throw error;
  }
  const suppliers = await loadSupplierIndex();
  const idByNorm = new Map([...suppliers.entries()].map(([k, v]) => [k, v.id]));

  // 2. Journal
  const { data: log, error: logError } = await db()
    .from("predevis_catalogue_imports")
    .insert({
      source,
      file_name: fileName,
      row_count: plan.report.rows_read,
      inserted_count: plan.products.length,
      conflict_count: plan.report.conflicts.length,
      missing_price_count: plan.report.missing_price.length,
      created_by: userId,
    })
    .select("id")
    .single();
  if (logError) throw logError;
  const importId: string = log.id;

  const write = toWriteRows(plan, idByNorm);

  // 3. Produits (une référence = un produit)
  const productIdByCode = new Map<string, string>();
  for (let i = 0; i < write.products.length; i += CHUNK) {
    const chunk = write.products.slice(i, i + CHUNK).map((p) => ({ ...p, created_by: userId }));
    const { data, error } = await db()
      .from("predevis_products")
      .upsert(chunk, { onConflict: "norm_code" })
      .select("id, norm_code");
    if (error) throw error;
    for (const row of data ?? []) productIdByCode.set(row.norm_code, row.id);
  }

  // 4. Offres (une par produit × fournisseur × source)
  const offerRows = write.offers
    .map((o) => {
      const product_id = productIdByCode.get(o.norm_code);
      if (!product_id) return null;
      return {
        product_id,
        supplier_id: o.supplier_id,
        source: o.source,
        pau_ht: o.pau_ht,
        pau_raw: o.pau_raw,
        source_import_id: importId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  for (let i = 0; i < offerRows.length; i += CHUNK) {
    const { error } = await db()
      .from("predevis_offers")
      .upsert(offerRows.slice(i, i + CHUNK), { onConflict: "product_id,supplier_key,source" });
    if (error) throw error;
  }

  return { importId, productCount: productIdByCode.size, offerCount: offerRows.length };
}

