import { describe, expect, test } from "bun:test";
import {
  matchSupplier,
  type MatchContext,
  normKey,
  type QuoteLine,
  type SupplierRef,
} from "../assistant-ap-catalogue";
import { isServiceLine, normalizeQuoteLines, parseTabularQuote } from "../assistant-ap-quote";
import { supplyIssues } from "../assistant-ap-checks";

const suppliers: SupplierRef[] = [
  ["b&f", "Berger et fils"],
  ["touchat"],
  ["aef"],
  ["sj34"],
  ["ruiz"],
  ["pc"],
  ["lr merlin"],
  ["granier"],
  ["dmd"],
].map(([name], i) => ({ id: `s${i}`, name: name.toUpperCase() === name ? name : name }));
const byName = (n: string) => suppliers.find((s) => s.name.toLowerCase() === n)!;

const line = (item: string, extra: Partial<QuoteLine> = {}): QuoteLine => ({
  item,
  quantity: "1",
  category: "autre",
  plant_type: null,
  plant_liters: null,
  ...extra,
});
const ctx: MatchContext = { suppliers, memory: [], history: [] };
const who = (item: string, extra: Partial<QuoteLine> = {}, c = ctx) =>
  matchSupplier(line(item, extra), c).supplier?.name.toLowerCase() ?? null;

describe("catalogue fournisseurs", () => {
  test("règles du catalogue", () => {
    expect(who("Terre végétale enrichie")).toBe("b&f");
    expect(who("Terre végétale conteneur 35L")).toBe("b&f");
    expect(who("Amendement 25 kg")).toBe("touchat");
    expect(who("Ganivelles châtaignier")).toBe("touchat");
    expect(who("Terreau biologique professionnel")).toBe("touchat");
    expect(who("Canisse 2x3 m")).toBe("lr merlin");
    expect(who("Traverses 240")).toBe("granier");
    expect(who("Bordure corten")).toBe("granier");
  });
  test("spécificités SJ34 et PC", () => {
    expect(who("Terreau biologique")).toBe("sj34");
    expect(who("Terre végétale biologique")).toBe("sj34");
    expect(who("Arbuste de haie H2", { category: "vegetal" })).toBe("sj34");
    expect(who("Terreau composé")).toBe("pc");
  });
  test("végétaux selon le pot", () => {
    expect(who("Sauge 1L", { category: "vegetal", plant_liters: 1 })).toBe("aef");
    expect(who("Agapanthe", { category: "vegetal", plant_type: "vivace" })).toBe("aef");
    const r = matchSupplier(line("Nandina C15", { category: "vegetal" }), ctx);
    expect(r.supplier).toBeNull();
    expect(r.candidates).toEqual(["sj34", "ruiz", "pc"]);
  });
  test("arrosage = DMD", () => {
    expect(who("Goutteur auto-régulé")).toBe("dmd");
    expect(who("Tuyau PE D16 25mL")).toBe("dmd");
    expect(who("Micro-asperseur sur pique")).toBe("dmd");
    expect(who("Crampon de sol acier D13-32")).toBe("dmd");
    expect(who("Bouchons 4mm Grappe 10u")).toBe("dmd");
    expect(who("Programmateur", { category: "irrigation" })).toBe("dmd");
  });
  test("3L à 5L : AEF, PC ou SJ34 (pas Ruiz) ; au-delà : SJ34, Ruiz, PC", () => {
    const mid = matchSupplier(line("Arbuste 5L", { category: "vegetal", plant_liters: 5 }), ctx);
    expect(mid.supplier).toBeNull();
    expect(mid.candidates).toEqual(["aef", "pc", "sj34"]);
    const big = matchSupplier(line("Arbre C30", { category: "vegetal", plant_liters: 30 }), ctx);
    expect(big.candidates).toEqual(["sj34", "ruiz", "pc"]);
  });
  test("inconnu : reste vide", () => {
    expect(who("Objet décoratif")).toBeNull();
  });
  test("mémoire manuelle prioritaire sur le catalogue", () => {
    const memory = [{ norm_key: normKey("Amendement"), supplier_id: byName("ruiz").id, hits: 2 }];
    expect(who("Amendement 10 kg", {}, { ...ctx, memory })).toBe("ruiz");
  });
  test("historique dominant", () => {
    const history = [
      { item: "Orgasyl", supplier_id: byName("touchat").id },
      { item: "Orgasyl x1", supplier_id: byName("touchat").id },
    ];
    expect(who("2 Orgasyl", {}, { ...ctx, history })).toBe("touchat");
  });
});

describe("apprentissage de l'historique", () => {
  const h = (item: string, id: string) => ({ item, supplier_id: id });
  test("fiches par nom (sans lien) et alias reconnus", () => {
    const history = [{ item: "Orgasyl", supplier_id: null, supplier: "Touchat" }];
    expect(who("Orgasyl x3", {}, { ...ctx, history })).toBe("touchat");
  });
  test("pratique constante de l'historique prioritaire sur le catalogue", () => {
    const history = [
      h("Terreau pour bacs", byName("ruiz").id),
      h("Terreau pour bacs x2", byName("ruiz").id),
    ];
    expect(who("Terreau pour bacs", {}, { ...ctx, history })).toBe("ruiz");
  });
  test("une seule fiche ne contredit pas le catalogue", () => {
    const history = [h("Amendement 12kg", byName("ruiz").id)];
    expect(who("Amendement", {}, { ...ctx, history })).toBe("touchat");
  });
  test("tolère une faute de frappe", () => {
    const history = [h("Biochanvre", byName("touchat").id)];
    expect(who("Biochanvvre", {}, { ...ctx, history })).toBe("touchat");
  });
});

describe("devis", () => {
  test("exclut main-d'œuvre et services", () => {
    expect(isServiceLine("Main d'œuvre pose")).toBe(true);
    expect(isServiceLine("Déplacement")).toBe(true);
    expect(isServiceLine("Dallage grès 60x60")).toBe(false);
    const lines = normalizeQuoteLines({
      lines: [
        { item: "Main-d'œuvre", is_supply: true },
        { item: "Sauge", quantity: 5, is_supply: true, category: "vegetal" },
        { item: "Sauge", quantity: 5, is_supply: true },
        { item: "Forfait terrassement", is_supply: false },
      ],
    });
    expect(lines.map((l) => l.item)).toEqual(["Sauge"]);
    expect(lines[0].quantity).toBe("5");
  });
});

describe("éléments bloquants", () => {
  const base = { item: "Sauge", quantity: "3", mode: "retrait" as const, supplier_id: null };
  test("fournisseur vide = bloquant", () => {
    const i = supplyIssues({ ...base, supplier: "" }, suppliers);
    expect(i.some((x) => x.level === "blocking")).toBe(true);
  });
  test("fournisseur ambigu = bloquant, quantité manquante = alerte", () => {
    const i = supplyIssues({ ...base, supplier: "PC ou SJ34", quantity: null }, suppliers);
    expect(i.map((x) => x.code)).toEqual(["supplier_ambiguous", "quantity"]);
  });
  test("fournisseur du catalogue = ok, stock = ok", () => {
    expect(supplyIssues({ ...base, supplier: "Touchat" }, suppliers)).toEqual([]);
    expect(supplyIssues({ ...base, supplier: "", mode: "stock" }, suppliers)).toEqual([]);
  });
});

describe("devis tableau (Henrri)", () => {
  const text = [
    "Référence Désignation Quantité PU Vente TVA Montant HT Image",
    "Plantations massif entrée + Cèdre",
    "AEF1,4AC Vivace 1,4L A-C AEF 3,00 8,2500 € 20,00 24,75 €",
    "AEF1,4AC (c… Vivace 1,4L A-C AEF 1,00 8,2500 € 20,00 8,25 €",
    "M5L Arbuste 5L 8,00 15,0000 € 20,00 120,00 €",
    "5LAEF Arbuste 5L AEF 1,00 22,4167 € 20,00 22,42 €",
    "MO Main d'oeuvre 1,00 58,3333 € 20,00 58,33 €",
    "T4 Terreau biologique professionnel - T4 11,00 22,4167 € 20,00 246,58 €",
    "AM2 Amendement organique racinaire - 2,00 37,5000 € 20,00 75,00 €",
    "Am2 (sac 25 kg)",
    "Sous Total 150,60 €",
  ].join("\n");
  const aef = { id: "a", name: "AEF", aliases: ["AEF"] };
  const lines = parseTabularQuote(text, [aef]);
  test("cumule, exclut la main-d'œuvre, garde le fournisseur écrit", () => {
    expect(lines.find((l) => l.item === "Vivace 1,4L A-C")?.quantity).toBe("4");
    expect(lines.some((l) => /main/i.test(l.item))).toBe(false);
    expect(lines.filter((l) => l.item === "Arbuste 5L").map((l) => l.supplier_tag)).toEqual([
      null,
      "AEF",
    ]);
  });
  test("désignation sur deux lignes", () => {
    expect(lines.find((l) => l.item.startsWith("Amendement"))?.item).toContain("sac 25 kg");
  });
});
