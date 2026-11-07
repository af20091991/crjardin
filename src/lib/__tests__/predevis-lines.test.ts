import { describe, expect, test } from "bun:test";
import {
  lineFinance,
  suggestedMultiplier,
  uniqueSupplierPurchase,
  type StoredLine,
} from "../predevis-lines";

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

describe("uniqueSupplierPurchase", () => {
  test("un seul fournisseur : PAU de l'offre, coût connu, pièce = multiplicateur 1", () => {
    const r = uniqueSupplierPurchase(
      [{ supplier_id: "s1", source: "excel", pau_ht: 4.2 }],
      "pièce",
    );
    expect(r?.pau_ht_applied).toBe(4.2);
    expect(r?.cost_status).toBe("connu");
    expect(r?.unit_status).toBe("ok");
  });
  test("plusieurs fournisseurs : aucun choix automatique", () => {
    const r = uniqueSupplierPurchase(
      [
        { supplier_id: "s1", source: "excel", pau_ht: 4 },
        { supplier_id: "s2", source: "excel", pau_ht: 5 },
      ],
      "pièce",
    );
    expect(r).toBeNull();
  });
  test("prix manquant : coût manquant, jamais estimé", () => {
    const r = uniqueSupplierPurchase([{ supplier_id: null, source: "henrri", pau_ht: null }], null);
    expect(r?.pau_ht_applied).toBeNull();
    expect(r?.cost_status).toBe("manquant");
  });
});
