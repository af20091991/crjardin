import { describe, expect, test } from "bun:test";
import { parseQuote, type PdfWord } from "../predevis-quote-parse";
import fixture from "./fixtures/predevis/labachelerie-words.json";

const quote = parseQuote((fixture as { items: PdfWord[] }).items);

describe("devis labachelerie (3 pages, colonnes décalées par page)", () => {
  test("cinq postes, tous contrôlés contre leur Sous Total", () => {
    expect(quote.postes.map((p) => p.subtotalHt)).toEqual([2654.11, 1703.12, 2469.92, 1047.5, 645]);
    expect(quote.postes.every((p) => p.status === "ok")).toBe(true);
    expect(quote.warnings).toEqual([]);
  });

  test("montants à espace de milliers lus correctement", () => {
    const mo = quote.postes[0].rows[0];
    expect(mo.kind).toBe("mo");
    expect(mo.pu).toBe(1400);
    expect(quote.postes[2].rows.find((r) => r.ref === "CS3")?.ht).toBe(1063.92);
  });

  test("référence tronquée « (copi… » nettoyée", () => {
    expect(quote.postes[1].rows.find((r) => r.refRaw?.startsWith("AEF1L"))?.ref).toBe("AEF1L");
  });
});
