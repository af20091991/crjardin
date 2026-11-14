// Pré-devis — accès données (catalogue). Passe par la RLS : seuls les admins peuvent lire ou écrire.
//
// NOTE : types.ts n'est pas encore régénéré pour les tables predevis_*.
// Le client est donc utilisé sans typage strict, comme dans assistant-ap.ts.
// À retirer après la resynchronisation des types dans l'éditeur Lovable.
import { supabase } from "@/integrations/supabase/client";
import type { CatalogueSource } from "./predevis-catalogue-normalize";
import type { AefSpecies } from "./predevis-catalogue-aef";
import { potKey } from "./predevis-catalogue-aef";
import {
  buildCatalogueImport,
  type ImportPlan,
  type RawRow,
  type ExistingOffer,
} from "./predevis-catalogue-import";
import { dedupeOfferRows, suppliersToCreate, toWriteRows } from "./predevis-catalogue-write";
import {
  matchQuoteRow,
  supplierOptions,
  type CatalogueOffer,
  type CatalogueProduct,
  type MatchResult,
  type SupplierOption,
} from "./predevis-match";
import {
  lineFinance,
  suggestedMultiplier,
  uniqueSupplierPurchase,
  type OfferRow,
  type StoredLine,
} from "./predevis-lines";
import { posteFinance, type PosteFinance } from "./predevis-finance";

import type { QuoteParse } from "./predevis-quote-parse";
import { clientBlock } from "./predevis-client-block";
import {
  manualLineFields,
  storedPosteRecap,
  type ManualHeader,
  type ManualValues,
} from "./predevis-recap";
import { detectThemes } from "./predevis-themes";

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
  // Un même lot ne peut pas contenir deux fois la même offre (ON CONFLICT) : la plus haute gagne.
  const dedupedOffers = dedupeOfferRows(offerRows);

  for (let i = 0; i < dedupedOffers.length; i += CHUNK) {
    const { error } = await db()
      .from("predevis_offers")
      .upsert(dedupedOffers.slice(i, i + CHUNK), { onConflict: "product_id,supplier_key,source" });
    if (error) throw error;
  }

  return { importId, productCount: productIdByCode.size, offerCount: dedupedOffers.length };
}

// ---------------------------------------------------------------------------
// Pré-devis : enregistrement d'un devis lu (brouillon). Aucune valeur inventée :
// prix d'achat, fournisseur et unité restent à compléter.
// ---------------------------------------------------------------------------

export async function loadOffersByProduct(): Promise<Map<string, OfferRow[]>> {
  const { data, error } = await db()
    .from("predevis_offers")
    .select("product_id, supplier_id, source, pau_ht");
  if (error) throw error;
  const map = new Map<string, OfferRow[]>();
  for (const r of data ?? []) {
    const list = map.get(r.product_id) ?? [];
    list.push({
      supplier_id: r.supplier_id ?? null,
      source: r.source,
      pau_ht: r.pau_ht == null ? null : Number(r.pau_ht),
    });
    map.set(r.product_id, list);
  }
  return map;
}

export async function loadCatalogueProducts(): Promise<CatalogueProduct[]> {
  const { data, error } = await db()
    .from("predevis_products")
    .select("id, norm_code, code, designation, norm_designation, unit");
  if (error) throw error;
  return data ?? [];
}

/** Choix faits à l'import : clé = quoteRowKey (poste + position), valeur = produit choisi, ou null = non rattaché. */
export type MatchChoices = Record<string, string | null>;

export function quoteRowKey(posteIndex: number, position: number): string {
  return `${posteIndex}-${position}`;
}

/** Données de rattachement lues une fois, utilisées par l'écran d'import pour afficher le PAU détecté. */
export async function loadMatchContext(): Promise<{
  products: CatalogueProduct[];
  offersByProduct: Map<string, OfferRow[]>;
  unitById: Map<string, string | null>;
}> {
  const products = await loadCatalogueProducts();
  const offersByProduct = await loadOffersByProduct();
  const unitById = new Map(products.map((p) => [p.id, p.unit]));
  return { products, offersByProduct, unitById };
}

export async function saveQuoteDraft(args: {
  parse: QuoteParse;
  fileName: string;
  userId: string;
  choices?: MatchChoices;
  manual?: ManualValues;
  header?: ManualHeader;
}): Promise<{ quoteId: string; posteCount: number; lineCount: number }> {
  const { parse, fileName, userId, choices = {}, manual = {}, header = {} } = args;
  const products = await loadCatalogueProducts();
  const totalHtDeclared =
    header.totalHtDeclared !== undefined ? header.totalHtDeclared : parse.totalHtDeclared;

  const { data: quote, error: qe } = await db()
    .from("predevis_quotes")
    .insert({
      // Nom = titre de l'en-tête du PDF (modifiable à l'import) ; à défaut, le nom du fichier.
      title: header.title?.trim() || parse.title || fileName,
      devis_number: parse.devisNumber,
      source_file_name: fileName,
      total_ht_declared: totalHtDeclared,
      status: "brouillon",
      created_by: userId,
    })
    .select("id")
    .single();
  if (qe) throw qe;
  const quoteId: string = quote.id;

  try {
    return await writePostesAndLines(quoteId, parse, products, choices, manual, header);
  } catch (e) {
    // Pas de transaction côté client : on retire le devis partiel pour ne pas laisser un brouillon incomplet.
    await db().from("predevis_quotes").delete().eq("id", quoteId);
    throw e;
  }
}

async function writePostesAndLines(
  quoteId: string,
  parse: QuoteParse,
  products: CatalogueProduct[],
  choices: MatchChoices,
  manual: ManualValues,
  header: ManualHeader,
): Promise<{ quoteId: string; posteCount: number; lineCount: number }> {
  const offersByProduct = await loadOffersByProduct();
  const unitById = new Map(products.map((p) => [p.id, p.unit]));
  let lineCount = 0;
  for (const poste of parse.postes) {
    const rows = poste.rows.map((r) => {
      const key = quoteRowKey(poste.index, r.position);
      const m: MatchResult =
        key in choices
          ? {
              status: choices[key] ? "manuel" : "aucun",
              productId: choices[key] ?? null,
              candidates: [],
              reason: choices[key] ? "Choisi à l'import." : "Non rattaché à l'import.",
            }
          : matchQuoteRow({ ref: r.ref, designation: r.designation }, products);
      return { key, row: r, match: m };
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
        subtotal_ht:
          header.subtotals && poste.index in header.subtotals
            ? header.subtotals[poste.index]
            : poste.subtotalHt,
        sst_cost_ht: header.sst?.[poste.index] ?? null,
        client_block: clientBlock(
          rows.map(({ key, row, match }) => ({
            kind: row.kind,
            designation: row.designation,
            clientDescription: null,
            quantity: manual[key]?.quantity ?? row.quantity,
            unit: match.productId ? (unitById.get(match.productId) ?? null) : null,
          })),
        ),
      })
      .select("id")
      .single();
    if (pe) throw pe;

    const lineRows = rows.map(({ key, row, match }) => ({
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
      // Achat appliqué seulement si le produit n'a qu'un fournisseur ; sinon le choix se fait dans l'éditeur.
      ...(match.productId
        ? (uniqueSupplierPurchase(
            offersByProduct.get(match.productId) ?? [],
            unitById.get(match.productId) ?? null,
          ) ?? {})
        : {}),
      // Saisie manuelle : prime sur l'achat détecté, ne remplace jamais une valeur par 0.
      ...manualLineFields(row.kind, manual[key]),
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
  archived_at?: string | null;
  superseded_at?: string | null;
};

export async function listQuotes(): Promise<QuoteSummary[]> {
  const { data, error } = await db()
    .from("predevis_quotes")
    .select(
      "id, title, devis_number, total_ht_declared, status, created_at, archived_at, superseded_at",
    )
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
  /** Coût de sous-traitance du poste (HT), saisi à la main. */
  sst_cost_ht?: number | null;
  /** Thème principal de travaux, choisi ou suggéré. */
  theme?: string | null;
  secondary_themes?: string[] | null;
};

export type StoredQuoteLine = Omit<StoredLine, "kind"> & {
  id: string;
  quote_id: string;
  line_kind: "fourniture" | "mo";
  continued: boolean;
  pu_ht: number | null;
  ht: number | null;
  ttc: number | null;
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
      .select(
        "id, title, devis_number, total_ht_declared, status, created_at, archived_at, superseded_at",
      )
      .eq("id", quoteId)
      .single(),
    db()
      .from("predevis_postes")
      .select(
        "id, position, title, review_status, subtotal_ht, client_block, sst_cost_ht, theme, secondary_themes",
      )
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

export type LineAmountPatch = {
  quantity?: number | null;
  pu_ht?: number | null;
  ht?: number | null;
  ttc?: number | null;
  unit_multiplier?: number | null;
  unit_status?: "ok" | "non_verifiee";
  pau_ht_applied?: number | null;
  manual_cost_ht?: number | null;
};

/**
 * Montants corrigés à la main sur un devis enregistré. Rien n'est recalculé :
 * ce qui est saisi est ce qui est enregistré (indicateurs recalculés à l'affichage).
 */
export async function saveQuoteAmounts(args: {
  quoteId: string;
  lines: Record<string, LineAmountPatch>;
  postes: Record<string, number | null>;
  /** Coût SST par poste (id du poste → montant HT). */
  sst?: Record<string, number | null>;
  totalHtDeclared?: number | null;
  title?: string;
}): Promise<void> {
  const { quoteId, lines, postes, sst, totalHtDeclared, title } = args;
  const ops: PromiseLike<{ error: unknown }>[] = [];
  if (title !== undefined) {
    ops.push(db().from("predevis_quotes").update({ title }).eq("id", quoteId));
  }
  for (const [id, patch] of Object.entries(lines)) {
    // Un achat saisi rend la ligne « connue », comme à l'import.
    const row = patch.pau_ht_applied != null ? { ...patch, cost_status: "connu" } : patch;
    ops.push(db().from("predevis_lines").update(row).eq("id", id));
  }
  for (const [id, subtotal_ht] of Object.entries(postes)) {
    ops.push(db().from("predevis_postes").update({ subtotal_ht }).eq("id", id));
  }
  for (const [id, sst_cost_ht] of Object.entries(sst ?? {})) {
    ops.push(db().from("predevis_postes").update({ sst_cost_ht }).eq("id", id));
  }
  if (totalHtDeclared !== undefined) {
    ops.push(
      db().from("predevis_quotes").update({ total_ht_declared: totalHtDeclared }).eq("id", quoteId),
    );
  }
  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  await refreshClientBlocks(quoteId);
}

export async function setPosteReview(
  posteId: string,
  review_status: "a_verifier" | "valide",
): Promise<void> {
  const { error } = await db().from("predevis_postes").update({ review_status }).eq("id", posteId);
  if (error) throw error;
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

// ---------------------------------------------------------------------------
// Catalogue AEF : une espèce de référence par produit générique (taille).
// Le prix pro HT de l'espèce devient l'offre « aef » du produit ; il prime sur Henrri.
// ---------------------------------------------------------------------------

/** Produits génériques AEF (libellé « … AEF »), avec leur clé de taille. */
export async function loadAefProducts(): Promise<
  Array<{ id: string; code: string; designation: string; sizeKey: string | null }>
> {
  const products = await loadCatalogueProducts();
  return products
    .filter((p) => /aef/i.test(`${p.code} ${p.designation}`))
    .map((p) => ({
      id: p.id,
      code: p.code,
      designation: p.designation,
      sizeKey: potKey(p.designation),
    }))
    .sort((a, b) => a.designation.localeCompare(b.designation, "fr"));
}

/** Enregistre l'espèce choisie pour chaque produit AEF (une offre « aef » par produit). */
export async function saveAefChoices(args: {
  choices: Record<string, AefSpecies>;
  userId: string;
}): Promise<{ offerCount: number }> {
  const entries = Object.entries(args.choices);
  if (entries.length === 0) return { offerCount: 0 };
  const { error: se } = await db()
    .from("predevis_suppliers")
    .upsert([{ name: "AEF", norm_name: "aef", created_by: args.userId }], {
      onConflict: "norm_name",
      ignoreDuplicates: true,
    });
  if (se) throw se;
  const supplierId = (await loadSupplierIndex()).get("aef")?.id;
  if (!supplierId) throw new Error("Fournisseur AEF introuvable.");

  const rows = entries.map(([productId, sp]) => ({
    product_id: productId,
    supplier_id: supplierId,
    source: "aef",
    pau_ht: sp.proPriceHt,
    pau_raw: `${sp.species} (${sp.size})`,
  }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db()
      .from("predevis_offers")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "product_id,supplier_key,source" });
    if (error) throw error;
  }
  return { offerCount: rows.length };
}

// ---------------------------------------------------------------------------
// Pré-devis 3.0 : archivage, versions écartées, thèmes et historique par thème.
// ---------------------------------------------------------------------------

/** Ligne enregistrée mise au format de calcul des marges. */
export function toStoredLine(l: StoredQuoteLine): StoredLine {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    kind: l.line_kind,
    quantity: n(l.quantity),
    ht: n(l.ht),
    ttc: n(l.ttc),
    pau_ht_applied: n(l.pau_ht_applied),
    cost_status: l.cost_status,
    unit_status: l.unit_status,
    unit_multiplier: n(l.unit_multiplier),
    manual_cost_ht: n(l.manual_cost_ht),
    zero_cost_reason: l.zero_cost_reason,
  };
}

export async function setQuoteFlags(
  quoteId: string,
  flags: { archived_at?: string | null; superseded_at?: string | null },
): Promise<void> {
  const { error } = await db().from("predevis_quotes").update(flags).eq("id", quoteId);
  if (error) throw error;
}

/** Écarte les versions plus anciennes d'un même devis (hors la version gardée). */
export async function supersedeOlderVersions(args: {
  devisNumber: string;
  keepQuoteId: string;
  keptCreatedAt: string;
}): Promise<void> {
  const { error } = await db()
    .from("predevis_quotes")
    .update({ superseded_at: new Date().toISOString() })
    .eq("devis_number", args.devisNumber)
    .neq("id", args.keepQuoteId)
    .lt("created_at", args.keptCreatedAt)
    .is("superseded_at", null);
  if (error) throw error;
}

export async function setPosteTheme(
  posteId: string,
  theme: string | null,
  secondary: string[],
): Promise<void> {
  const { error } = await db()
    .from("predevis_postes")
    .update({ theme, secondary_themes: secondary })
    .eq("id", posteId);
  if (error) throw error;
}

/** Thème suggéré pour un poste, à partir de son titre et de ses désignations. */
export function suggestedTheme(
  title: string,
  lines: StoredQuoteLine[],
): { main: string | null; secondary: string[] } {
  return detectThemes(
    title,
    lines.map((l) => l.designation),
  );
}

export type ThemeHistory = {
  postes: number;
  pvHt: number;
  margeHt: number;
  margeAvecSstHt: number;
};

/** Historique par thème : postes des devis archivés et non écartés, avec leur marge. */
export async function loadThemeBenchmark(): Promise<Map<string, ThemeHistory>> {
  const out = new Map<string, ThemeHistory>();
  const quotes = await db()
    .from("predevis_quotes")
    .select("id")
    .not("archived_at", "is", null)
    .is("superseded_at", null);
  if (quotes.error) throw quotes.error;
  const ids: string[] = (quotes.data ?? []).map((q: { id: string }) => q.id);
  if (ids.length === 0) return out;

  const [postes, lines] = await Promise.all([
    db()
      .from("predevis_postes")
      .select("id, quote_id, theme, sst_cost_ht")
      .in("quote_id", ids)
      .not("theme", "is", null),
    db().from("predevis_lines").select("*").in("quote_id", ids),
  ]);
  if (postes.error) throw postes.error;
  if (lines.error) throw lines.error;

  for (const p of postes.data ?? []) {
    const rows = (lines.data ?? []).filter((l: StoredQuoteLine) => l.poste_id === p.id);
    const sst = p.sst_cost_ht == null ? null : Number(p.sst_cost_ht);
    const fin = storedPosteRecap(rows.map(toStoredLine), sst);
    if (fin.pvHt == null || fin.margeHt == null) continue;
    const cur = out.get(p.theme) ?? { postes: 0, pvHt: 0, margeHt: 0, margeAvecSstHt: 0 };
    out.set(p.theme, {
      postes: cur.postes + 1,
      pvHt: cur.pvHt + fin.pvHt,
      margeHt: cur.margeHt + fin.margeHt,
      margeAvecSstHt: cur.margeAvecSstHt + (fin.margeAvecSstHt ?? fin.margeHt),
    });
  }
  return out;
}

/** Prestation sans achat (SAV, garantie) : les lignes de fourniture sans prix sont marquées « sans achat ». */
export async function markPosteWithoutPurchase(posteId: string): Promise<void> {
  const { error } = await db()
    .from("predevis_lines")
    .update({ zero_cost_reason: "sav" })
    .eq("poste_id", posteId)
    .eq("line_kind", "fourniture")
    .is("pau_ht_applied", null)
    .is("zero_cost_reason", null);
  if (error) throw error;
}
