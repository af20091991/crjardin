import { describe, expect, test } from "bun:test";
import {
  matchQuoteRow,
  supplierOptions,
  type CatalogueOffer,
  type CatalogueProduct,
} from "../predevis-match";
import { normCode, normDesignation } from "../predevis-catalogue-normalize";
import { parseQuote, type PdfWord } from "../predevis-quote-parse";
import henrri from "./fixtures/predevis/henrri-subset.json";
import quoteFixture from "./fixtures/predevis/quote-body.json";

type HenrriItem = {
  reference: string;
  designation: string;
  pa_ht: number | null;
  unit: string | null;
};
const items = (henrri as { items: HenrriItem[] }).items;

const products: CatalogueProduct[] = items.map((i, n) => ({
  id: `p${n}`,
  norm_code: normCode(i.reference)!,
  code: i.reference,
  designation: i.designation,
  norm_designation: normDesignation(i.designation),
  unit: i.unit,
}));
const offers: CatalogueOffer[] = items.map((i, n) => ({
  product_id: `p${n}`,
  supplier_id: null,
  supplier_name: null,
  source: "henrri",
  pau_ht: i.pa_ht,
}));

const quote = parseQuote((quoteFixture as { items: PdfWord[] }).items);
const quoteRows = quote.postes.flatMap((p) => p.rows);

describe("rattachement au catalogue — devis réel", () => {
  test("toutes les lignes hors MO trouvent leur produit par référence", () => {
    const fournitures = quoteRows.filter((r) => r.kind === "fourniture");
    const results = fournitures.map((r) => ({ ref: r.ref, ...matchQuoteRow(r, products) }));
    const unmatched = results.filter((r) => r.status !== "code");
    expect(unmatched.map((r) => r.ref)).toEqual([]);
  });

  test("le prix d'achat est repris sans estimation", () => {
    const t4 = quoteRows.find((r) => r.ref === "T4")!;
    const m = matchQuoteRow(t4, products);
    expect(m.status).toBe("code");
    const opts = supplierOptions(m.productId!, offers);
    expect(opts).toEqual([
      { supplier_id: null, supplier_name: null, pau_ht: 16.5, source: "henrri" },
    ]);
  });

  test("terreau biologique professionnel ≠ terreau biologique (désignation conservée)", () => {
    const pro = normDesignation("Terreau biologique professionnel - T4");
    const std = normDesignation("Terreau biologique 40L");
    expect(pro).not.toBe(std);
  });
});

describe("rattachement — cas de repli", () => {
  test("référence absente : rapprochement par désignation exacte", () => {
    const m = matchQuoteRow({ ref: null, designation: "Billes d'argile - T5" }, products);
    expect(m.status).toBe("designation");
    expect(products.find((p) => p.id === m.productId)?.code).toBe("T5");
  });

  test("pas de correspondance : aucun choix automatique, prix à saisir", () => {
    const m = matchQuoteRow(
      { ref: "ZZZ999", designation: "Produit inexistant hors catalogue" },
      products,
    );
    expect(m.status).toBe("aucun");
    expect(m.productId).toBeNull();
  });

  test("candidats proposés sans choix automatique", () => {
    const m = matchQuoteRow(
      { ref: "XX", designation: "Terre végétale criblée enrichie" },
      products,
    );
    expect(m.productId).toBeNull();
    expect(m.status).toBe("a_confirmer");
    expect(m.candidates.length).toBeGreaterThan(0);
  });
});

describe("fournisseurs proposés", () => {
  test("un prix par fournisseur, prix manquant jamais estimé", () => {
    const pid = "p0";
    const list: CatalogueOffer[] = [
      { product_id: pid, supplier_id: "s1", supplier_name: "SJ34", source: "excel", pau_ht: 14.4 },
      { product_id: pid, supplier_id: "s2", supplier_name: "Ruiz", source: "excel", pau_ht: null },
      { product_id: pid, supplier_id: "s1", supplier_name: "SJ34", source: "henrri", pau_ht: 15 },
    ];
    const opts = supplierOptions(pid, list);
    expect(opts.find((o) => o.supplier_name === "SJ34")?.pau_ht).toBe(15);
    expect(opts.find((o) => o.supplier_name === "Ruiz")?.pau_ht).toBeNull();
  });
});
