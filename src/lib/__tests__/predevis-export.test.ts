import { describe, expect, test } from "bun:test";
import { buildQuoteExportHtml, exportAmount, rowTsv, type ExportQuote } from "../predevis-export";
import { chantierFinance, posteFinance } from "../predevis-finance";

const fin = posteFinance([
  { kind: "fourniture", ht: 100, ttc: 120, costHt: 40, zeroCostReason: null },
]);

const quote: ExportQuote = {
  title: "Devis <Labachelerie> & fils",
  devisNumber: "I-26-08-10",
  createdAt: "2026-11-14T12:00:00Z",
  archived: false,
  totalHtDeclared: 100,
  chantier: chantierFinance([fin]),
  postes: [
    {
      index: 1,
      title: 'Travaux "préparatoires"',
      themes: ["Travaux préparatoires"],
      fin,
      sst: null,
      clientText: "Nivellement <b>du sol</b>",
      rows: [
        {
          ref: "A1",
          designation: "Terre végétale",
          kind: "fourniture",
          continued: false,
          quantity: 2,
          pau: 40,
          pauLabel: "",
          pu: 50,
          ht: 100,
          ttc: 120,
          rattachement: "TVC35",
        },
      ],
    },
  ],
};

describe("export copiable", () => {
  test("montants à coller : virgule décimale, sans symbole", () => {
    expect(exportAmount(1234.5)).toBe("1234,50");
    expect(exportAmount(null)).toBe("");
  });

  test("ligne au format tabulé", () => {
    expect(rowTsv(quote.postes[0].rows[0])).toBe(
      "A1\tTerre végétale\t2,00\t40,00\t50,00\t100,00\t120,00",
    );
  });

  test("document autonome, texte échappé, valeurs cliquables", () => {
    const html = buildQuoteExportHtml(quote);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Devis &lt;Labachelerie&gt; &amp; fils");
    expect(html).not.toContain("<b>du sol</b>");
    expect(html).toContain('data-copy="100,00"');
    expect(html).toContain('data-copy="A1\tTerre');
  });
});
