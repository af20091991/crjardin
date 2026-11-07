import { describe, expect, test } from "bun:test";
import { lineFinance, suggestedMultiplier, type StoredLine } from "../predevis-lines";

const base: StoredLine = {
  kind: "fourniture",
  quantity: 22,
  ht: 109.12,
  ttc: 130.94,
  pau_ht_applied: 0.68,
  cost_status: "connu",
  unit_status: "ok",
  unit_multiplier: 1,
  manual_cost_ht: null,
  zero_cost_reason: null,
};

describe("lineFinance", () => {
  test("fourniture : quantité × multiplicateur × PAU", () => {
    expect(lineFinance(base).costHt).toBe(14.96);
  });

  test("unité non vérifiée : coût inconnu, jamais estimé", () => {
    expect(lineFinance({ ...base, unit_status: "non_verifiee" }).costHt).toBeNull();
  });

  test("PAU absent : coût inconnu", () => {
    expect(
      lineFinance({ ...base, pau_ht_applied: null, cost_status: "manquant" }).costHt,
    ).toBeNull();
  });

  test("main-d'œuvre : coût saisi, 0 € accepté avec motif", () => {
    const mo: StoredLine = {
      ...base,
      kind: "mo",
      pau_ht_applied: null,
      manual_cost_ht: 0,
      zero_cost_reason: "sav",
    };
    expect(lineFinance(mo).costHt).toBe(0);
    expect(lineFinance(mo).zeroCostReason).toBe("sav");
  });
});

describe("suggestedMultiplier", () => {
  test("pièce → 1 ; autre unité → à saisir", () => {
    expect(suggestedMultiplier("pièce")).toBe(1);
    expect(suggestedMultiplier("kg")).toBeNull();
    expect(suggestedMultiplier(null)).toBeNull();
  });
});
