// Pré-devis — accès données (catalogue). Passe par la RLS : seuls les admins peuvent lire ou écrire.
//
// NOTE : types.ts n'est pas encore régénéré pour les tables predevis_*.
// Le client est donc utilisé sans typage strict, comme dans assistant-ap.ts.
// À retirer après la resynchronisation des types dans l'éditeur Lovable.
import { supabase } from "@/integrations/supabase/client";
import type { CatalogueSource } from "./predevis-catalogue-normalize";
import {
  buildCatalogueImport,
  type ImportPlan,
  type RawRow,
  type ExistingOffer,
} from "./predevis-catalogue-import";
import { suppliersToCreate, toWriteRows } from "./predevis-catalogue-write";
import {
  matchQuoteRow,
  supplierOptions,
  type CatalogueOffer,
  type CatalogueProduct,
  type SupplierOption,
} from "./predevis-match";
import { lineFinance, suggestedMultiplier, type StoredLine } from "./predevis-lines";
import { posteFinance, type PosteFinance } from "./predevis-finance";

import type { QuoteParse } from "./predevis-quote-parse";
import { clientBlock } from "./predevis-client-block";

// Temporaire : types.ts ne contient pas encore les tables predevis_* (resynchronisation Lovable à faire).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as unknown as { from: (table: string) => any };
const CHUNK = 500;

export async function loadSupplierIndex(): Promise<Map<string, { id: string; name: string }>> {
  const { data, error } = await db().from("predevis_suppliers").select("id, name, norm_name");
  if (error) throw error;
  return new Map(
    (data ?? []).map((s: { id: string; name: string; norm_name: string }) => [
      s.norm_name,
      { id: s.id, name: s.name },
    ]),
  );
}

export async function loadExistingOffers(): Promise<ExistingOffer[]> {
  const [
    { data: products, error: pe },
    { data: suppliers, error: se },
    { data: offers, error: oe },
  ] = await Promise.all([
    db().from("predevis_products").select("id, norm_code"),
    db().from("predevis_suppliers").select("id, name"),
    db().from("predevis_offers").select("product_id, supplier_id, source, pau_ht"),
  ]);
  if (pe) throw pe;
  if (se) throw se;
  if (oe) throw oe;
  const codeById = new Map(
    (products ?? []).map((p: { id: string; norm_code: string }) => [p.id, p.norm_code]),
  );
  const nameById = new Map(
    (suppliers ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
  );
  return (offers ?? []).map(
    (o: {
      product_id: string;
      supplier_id: string | null;
      source: CatalogueSource;
      pau_ht: number | null;
    }) => ({
      norm_code: codeById.get(o.product_id) ?? "",
      supplier_name: o.supplier_id ? (nameById.get(o.supplier_id) ?? null) : null,
      source: o.source,
      pau_ht: o.pau_ht,
    }),
  );
}

/** Analyse le fichier sans rien écrire. */
export async function analyseCatalogue(
  source: CatalogueSource,
  rows: RawRow[],
): Promise<ImportPlan> {
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
      .upsert(
        toCreate.map((s) => ({ ...s, created_by: userId })),
        { onConflict: "norm_name", ignoreDuplicates: true },
      );
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

// ---------------------------------------------------------------------------
// Pré-devis : enregistrement d'un devis lu (brouillon). Aucune valeur inventée :
// prix d'achat, fournisseur et unité restent à compléter.
// ---------------------------------------------------------------------------

export async function loadCatalogueProducts(): Promise<CatalogueProduct[]> {
  const { data, error } = await db()
    .from("predevis_products")
    .select("id, norm_code, code, designation, norm_designation, unit");
  if (error) throw error;
  return data ?? [];
}

export async function saveQuoteDraft(args: {
  parse: QuoteParse;
  fileName: string;
  userId: string;
}): Promise<{ quoteId: string; posteCount: number; lineCount: number }> {
  const { parse, fileName, userId } = args;
  const products = await loadCatalogueProducts();

  const { data: quote, error: qe } = await db()
    .from("predevis_quotes")
    .insert({
      title: `Pré-devis ${parse.devisNumber ?? fileName}`,
      devis_number: parse.devisNumber,
      source_file_name: fileName,
      total_ht_declared: parse.totalHtDeclared,
      status: "brouillon",
      created_by: userId,
    })
    .select("id")
    .single();
  if (qe) throw qe;
  const quoteId: string = quote.id;

  let lineCount = 0;
  for (const poste of parse.postes) {
    const rows = poste.rows.map((r) => {
      const m = matchQuoteRow({ ref: r.ref, designation: r.designation }, products);
      return { row: r, match: m };
    });

    const { data: created, error: pe } = await db()
      .from("predevis_postes")
      .insert({
        quote_id: quoteId,
        position: poste.index,
        title: poste.title ?? `Poste ${poste.index}`,
        description_lines: poste.descriptionLines,
        detection: "auto",
        review_status: "a_verifier",
        subtotal_ht: poste.subtotalHt,
        client_block: clientBlock(
          poste.rows.map((r) => ({
            kind: r.kind,
            designation: r.designation,
            clientDescription: null,
            quantity: r.quantity,
            unit: null,
          })),
        ),
      })
      .select("id")
      .single();
    if (pe) throw pe;

    const lineRows = rows.map(({ row, match }) => ({
      quote_id: quoteId,
      poste_id: created.id,
      position: row.position,
      source_ref: row.refRaw,
      designation: row.designation,
      line_kind: row.kind,
      continued: row.continued,
      quantity: row.quantity,
      pu_ht: row.pu,
      tva_rate: row.tvaRate,
      ht: row.ht,
      ttc: row.ttc,
      catalogue_product_id: match.productId,
      match_status: match.status,
      unit_status: "non_verifiee",
      cost_status: "manquant",
    }));
    for (let i = 0; i < lineRows.length; i += CHUNK) {
      const { error } = await db()
        .from("predevis_lines")
        .insert(lineRows.slice(i, i + CHUNK));
      if (error) throw error;
    }
    lineCount += lineRows.length;
  }

  return { quoteId, posteCount: parse.postes.length, lineCount };
}

// ---------------------------------------------------------------------------
// Pré-devis : lecture et mise à jour d'un devis enregistré.
// ---------------------------------------------------------------------------

export type QuoteSummary = {
  id: string;
  title: string;
  devis_number: string | null;
  total_ht_declared: number | null;
  status: string;
  created_at: string;
};

export async function listQuotes(): Promise<QuoteSummary[]> {
  const { data, error } = await db()
    .from("predevis_quotes")
    .select("id, title, devis_number, total_ht_declared, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type StoredPoste = {
  id: string;
  position: number;
  title: string;
  review_status: "a_verifier" | "valide";
  subtotal_ht: number | null;
  client_block: string | null;
};

export type StoredQuoteLine = StoredLine & {
  id: string;
  quote_id: string;
  poste_id: string | null;
  position: number;
  source_ref: string | null;
  designation: string;
  quantity: number | null;
  catalogue_product_id: string | null;
  supplier_id: string | null;
  match_status: string;
  unit: string | null;
  client_description: string | null;
};

export type QuoteDetail = {
  quote: QuoteSummary;
  postes: StoredPoste[];
  lines: StoredQuoteLine[];
  products: CatalogueProduct[];
  offers: CatalogueOffer[];
  suppliers: Array<{ id: string; name: string }>;
};

export async function loadQuoteDetail(quoteId: string): Promise<QuoteDetail> {
  const [quote, postes, lines, products, offers, suppliers] = await Promise.all([
    db()
      .from("predevis_quotes")
      .select("id, title, devis_number, total_ht_declared, status, created_at")
      .eq("id", quoteId)
      .single(),
    db()
      .from("predevis_postes")
      .select("id, position, title, review_status, subtotal_ht, client_block")
      .eq("quote_id", quoteId)
      .order("position"),
    db().from("predevis_lines").select("*").eq("quote_id", quoteId).order("position"),
    loadCatalogueProducts(),
    db().from("predevis_offers").select("product_id, supplier_id, source, pau_ht"),
    db().from("predevis_suppliers").select("id, name"),
  ]);
  for (const r of [quote, postes, lines, offers, suppliers]) if (r.error) throw r.error;

  const supplierName = new Map(
    (suppliers.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
  );
  return {
    quote: quote.data,
    postes: postes.data ?? [],
    lines: lines.data ?? [],
    products,
    offers: (offers.data ?? []).map(
      (o: {
        product_id: string;
        supplier_id: string | null;
        source: CatalogueSource;
        pau_ht: number | null;
      }) => ({
        product_id: o.product_id,
        supplier_id: o.supplier_id,
        supplier_name: o.supplier_id ? (supplierName.get(o.supplier_id) ?? null) : null,
        source: o.source,
        pau_ht: o.pau_ht,
      }),
    ),
    suppliers: suppliers.data ?? [],
  };
}

/** Fournisseurs proposés pour la fourniture rattachée à une ligne, avec leur prix. */
export function linePurchaseOptions(
  line: StoredQuoteLine,
  offers: CatalogueOffer[],
): SupplierOption[] {
  return line.catalogue_product_id ? supplierOptions(line.catalogue_product_id, offers) : [];
}

/** Choisit un fournisseur : le PAU de son offre est copié dans la ligne. */
export async function chooseSupplier(
  line: StoredQuoteLine,
  option: SupplierOption,
  productUnit: string | null,
): Promise<void> {
  const cost_status = option.pau_ht == null ? "manquant" : "connu";
  const multiplier = suggestedMultiplier(productUnit);
  const { error } = await db()
    .from("predevis_lines")
    .update({
      supplier_id: option.supplier_id,
      pau_ht_applied: option.pau_ht,
      cost_status,
      unit_multiplier: line.unit_multiplier ?? multiplier,
      unit_status: line.unit_status === "ok" || multiplier != null ? "ok" : "non_verifiee",
    })
    .eq("id", line.id);
  if (error) throw error;
  await refreshClientBlocks(line.quote_id);
}

export async function updateLineFields(
  quoteId: string,
  lineId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await db().from("predevis_lines").update(patch).eq("id", lineId);
  if (error) throw error;
  await refreshClientBlocks(quoteId);
}

export async function setPosteReview(
  posteId: string,
  review_status: "a_verifier" | "valide",
): Promise<void> {
  const { error } = await db().from("predevis_postes").update({ review_status }).eq("id", posteId);
  if (error) throw error;
}

/** Indicateurs d'un poste, calculés depuis ses lignes enregistrées. */
export function computePosteFinance(lines: StoredQuoteLine[]): PosteFinance {
  return posteFinance(lines.map(lineFinance));
}

// ---------------------------------------------------------------------------
// Pré-devis : déplacement de ligne et régénération des blocs texte client.
// ---------------------------------------------------------------------------

export async function moveLineToPoste(
  quoteId: string,
  lineId: string,
  posteId: string | null,
): Promise<void> {
  const { error } = await db()
    .from("predevis_lines")
    .update({ poste_id: posteId })
    .eq("id", lineId);
  if (error) throw error;
  await refreshClientBlocks(quoteId);
}

/** Recalcule le bloc texte client de chaque poste à partir des lignes actuelles. Sans prix ni marge. */
export async function refreshClientBlocks(quoteId: string): Promise<void> {
  const [postes, lines, products] = await Promise.all([
    db().from("predevis_postes").select("id").eq("quote_id", quoteId),
    db()
      .from("predevis_lines")
      .select(
        "id, poste_id, line_kind, designation, client_description, quantity, catalogue_product_id, ht",
      )
      .eq("quote_id", quoteId),
    loadCatalogueProducts(),
  ]);
  if (postes.error) throw postes.error;
  if (lines.error) throw lines.error;
  const unitById = new Map(products.map((p) => [p.id, p.unit]));

  for (const poste of postes.data ?? []) {
    const block = clientBlock(
      (lines.data ?? [])
        .filter((l: { poste_id: string | null }) => l.poste_id === poste.id)
        .map(
          (l: {
            line_kind: "fourniture" | "mo";
            designation: string;
            client_description: string | null;
            quantity: number | null;
            catalogue_product_id: string | null;
          }) => ({
            kind: l.line_kind,
            designation: l.designation,
            clientDescription: l.client_description,
            quantity: l.quantity,
            unit: l.catalogue_product_id ? (unitById.get(l.catalogue_product_id) ?? null) : null,
          }),
        ),
    );
    const { error } = await db()
      .from("predevis_postes")
      .update({ client_block: block })
      .eq("id", poste.id);
    if (error) throw error;
  }
}
