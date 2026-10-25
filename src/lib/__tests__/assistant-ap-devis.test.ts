import { describe, expect, test } from "bun:test";
import {
  matchSupplier,
  type MatchContext,
  normKey,
  type QuoteLine,
  type SupplierRef,
} from "../assistant-ap-catalogue";
import { isServiceLine, normalizeQuoteLines } from "../assistant-ap-quote";
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
