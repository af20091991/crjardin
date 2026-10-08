import { describe, expect, it } from "bun:test";
import { normalizeLayout, reorderLayout } from "@/lib/pilot-dashboard-layout";

describe("personnalisation de la page", () => {
  it("conserve les anciennes préférences et complète les largeurs", () => {
    expect(normalizeLayout({ order: ["b", "a"], hidden: ["c"], pinned: ["b"] })).toEqual({
      order: ["b", "a"],
      hidden: ["c"],
      pinned: ["b"],
      widths: {},
    });
  });
  it("déplace sans modifier visibilité ni largeur et libère l'ordre épinglé", () => {
    const state = normalizeLayout({
      order: ["a", "b", "c"],
      hidden: ["c"],
      pinned: ["a"],
      widths: { b: "half" },
    });
    const next = reorderLayout(state, state.order, 1, 0);
    expect(next.order).toEqual(["b", "a", "c"]);
    expect(next.pinned).toEqual([]);
    expect(next.hidden).toEqual(["c"]);
    expect(next.widths).toEqual({ b: "half" });
    expect(state.order).toEqual(["a", "b", "c"]);
  });
  it("ignore les déplacements hors limites", () => {
    const state = normalizeLayout({ order: ["a", "b"] });
    expect(reorderLayout(state, state.order, -1, 0)).toBe(state);
    expect(reorderLayout(state, state.order, 0, 2)).toBe(state);
  });
  it("filtre les préférences invalides", () => {
    expect(
      normalizeLayout({ widths: { a: "half", b: "third", c: "invalid" } } as never).widths,
    ).toEqual({ a: "half", b: "third" });
  });
});
