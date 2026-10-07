import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PAGE,
  chartHeight,
  normalizeLayout,
  orderBlocks,
  sizeClass,
} from "@/lib/pilot-dashboard-layout";

describe("dashboard — organisation personnalisée", () => {
  it("accepte une ancienne préférence (ordre / masqué / épinglé seulement)", () => {
    const layout = normalizeLayout({ order: ["b", "a"], hidden: ["a"], pinned: [] });
    expect(layout.order).toEqual(["b", "a"]);
    expect(layout.hidden).toEqual(["a"]);
    expect(layout.sizes).toEqual({});
    expect(layout.extras).toEqual([]);
    expect(layout.page).toEqual(DEFAULT_PAGE);
  });

  it("ignore les valeurs invalides sans échouer", () => {
    const layout = normalizeLayout({
      order: "pas une liste",
      sizes: { a: "half", b: "énorme", c: 3 },
      heights: { a: "tall", b: "x" },
      titles: { a: "  Mon titre  ", b: "   ", c: 12 },
      extras: ["w:x:1", "w:x:1", 4],
      page: { density: "bizarre", showHealth: "oui", title: "T" },
    });
    expect(layout.order).toEqual([]);
    expect(layout.sizes).toEqual({ a: "half" });
    expect(layout.heights).toEqual({ a: "tall" });
    expect(layout.titles).toEqual({ a: "Mon titre" });
    expect(layout.extras).toEqual(["w:x:1"]);
    expect(layout.page).toEqual({ ...DEFAULT_PAGE, title: "T" });
  });

  it("renvoie la préférence vide pour tout ce qui n'est pas un objet", () => {
    expect(normalizeLayout(null).order).toEqual([]);
    expect(normalizeLayout("x").extras).toEqual([]);
    expect(normalizeLayout([1]).pinned).toEqual([]);
  });

  it("orderBlocks : ordre par défaut, puis ordre choisi, épinglés en tête", () => {
    expect(orderBlocks(["a", "b", "c"], [], [])).toEqual(["a", "b", "c"]);
    expect(orderBlocks(["a", "b", "c"], ["c", "a", "b"], [])).toEqual(["c", "a", "b"]);
    expect(orderBlocks(["a", "b", "c"], ["c", "a", "b"], ["b"])).toEqual(["b", "c", "a"]);
  });

  it("orderBlocks : un nouveau bloc se place après son prédécesseur par défaut", () => {
    // Préférence enregistrée avant l'ajout de « b2 » (qui suit « b » par défaut).
    expect(orderBlocks(["a", "b", "b2", "c"], ["c", "a", "b"], [])).toEqual(["c", "a", "b", "b2"]);
    expect(orderBlocks(["a", "b", "b2", "c"], ["b", "c", "a"], [])).toEqual(["b", "b2", "c", "a"]);
  });

  it("orderBlocks : un bloc supprimé de la page disparaît de l'ordre", () => {
    expect(orderBlocks(["a", "c"], ["c", "x", "a"], ["x"])).toEqual(["c", "a"]);
  });

  it("largeurs et hauteurs", () => {
    expect(sizeClass("full")).toBe("col-span-12");
    expect(sizeClass("half")).toContain("xl:col-span-6");
    expect(chartHeight("normal") === undefined).toBe(true);
    expect(chartHeight("compact")).toBe("9rem");
    expect(chartHeight("tall")).toBe("22rem");
  });
});
