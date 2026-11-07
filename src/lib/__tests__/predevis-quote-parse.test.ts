import { describe, expect, test } from "bun:test";
import { cleanReference, parseQuote, type PdfWord } from "../predevis-quote-parse";
import fixture from "./fixtures/predevis/quote-body.json";

const words = (fixture as { items: PdfWord[] }).items;
const quote = parseQuote(words);

describe("devis Henrri réel — en-tête et total", () => {
  test("numéro et total HT déclaré", () => {
    expect(quote.devisNumber).toBe("I-26-08-10");
    expect(quote.totalHtDeclared).toBe(3647.98);
  });

  test("aucune donnée de l'en-tête client ou émetteur", () => {
    const json = JSON.stringify(quote);
    expect(json).not.toContain("RIGUET");
    expect(json).not.toContain("Flaugergues");
  });
});

describe("devis Henrri réel — postes", () => {
  test("trois postes, sous-totaux contrôlés", () => {
    expect(quote.postes.map((p) => p.subtotalHt)).toEqual([1935.85, 1000.22, 711.91]);
    expect(quote.postes.every((p) => p.status === "ok")).toBe(true);
    expect(Math.max(...quote.postes.map((p) => Math.abs(p.deltaHt ?? 99)))).toBeLessThanOrEqual(0.05);
  });

  test("titres de poste en gras", () => {
    expect(quote.postes[0].title).toBe("Travaux préparatoires:");
    expect(quote.postes[1].title?.startsWith("Aménagement de la cour:")).toBe(true);
    expect(quote.postes[2].title).toBe("Mise en place d'un goutte à goutte avec programmateur Bluetooth");
  });

  test("nombre de lignes par poste", () => {
    expect(quote.postes.map((p) => p.rows.length)).toEqual([7, 8, 15]);
  });

  test("en-tête de tableau répété n'entre jamais dans un titre ou une description", () => {
    for (const p of quote.postes) {
      expect(p.descriptionLines.join(" ")).not.toContain("Référence Désignation");
    }
  });

  test("texte après le dernier Sous Total : hors poste, non affecté", () => {
    expect(quote.orphanText.join(" ")).toContain("Le présent devis ne prévoit pas");
    expect(quote.warnings.some((w) => w.includes("hors poste"))).toBe(true);
  });
});

describe("devis Henrri réel — lignes", () => {
  const rows = quote.postes.flatMap((p) => p.rows);

  test("référence nettoyée des copies et numéros", () => {
    expect(rows.find((r) => r.refRaw?.startsWith("T4"))?.ref).toBe("T4");
    expect(rows.find((r) => r.refRaw?.startsWith("AM2"))?.ref).toBe("AM2");
    expect(rows.find((r) => r.refRaw?.startsWith("MO1"))?.ref).toBe("MO1");
  });

  test("montants HT et PU lus sans arrondi", () => {
    const tvc = rows.find((r) => r.ref === "TVC35")!;
    expect(tvc.quantity).toBe(22);
    expect(tvc.pu).toBe(4.96);
    expect(tvc.ht).toBe(109.12);
  });

  test("TTC par ligne = HT × 1,2, arrondi au centime", () => {
    const mo = rows.find((r) => r.ref === "MO")!;
    expect(mo.ht).toBe(816.67);
    expect(mo.ttc).toBe(980);
    for (const r of rows) {
      if (r.ht != null) expect(r.ttc).toBe(Math.round(r.ht * 1.2 * 100) / 100);
    }
  });

  test("main-d'œuvre classée à part", () => {
    expect(rows.filter((r) => r.kind === "mo").map((r) => r.ref)).toEqual(["MO", "MO1", "MO"]);
  });

  test("suite de désignation rattachée à la ligne précédente et signalée", () => {
    const evac = rows.find((r) => r.ref === "MO")!;
    expect(evac.continued).toBe(true);
    expect(evac.designation).toContain("Évacuation des bordures");
    const e2 = rows.find((r) => r.ref === "E2")!;
    expect(e2.designation).toBe("Programmateur robinet 1 voie - Bluetooth - E2");
  });
});

describe("cleanReference", () => {
  test("retire les copies et suffixes numériques", () => {
    expect(cleanReference("T4 (copie)")).toBe("T4");
    expect(cleanReference("AM2 (copie1…")).toBe("AM2");
    expect(cleanReference("MO1 (2)")).toBe("MO1");
    expect(cleanReference("AEF1,4AC")).toBe("AEF1,4AC");
  });
});
