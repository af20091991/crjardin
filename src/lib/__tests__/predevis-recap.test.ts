import { describe, expect, test } from "bun:test";
import {
  cascadeAmounts,
  storedPosteRecap,
  manualLineFields,
  missingFields,
  previewStoredLine,
  posteClientText,
  posteRecap,
  type RecapRow,
} from "../predevis-recap";

const frn = (over: Partial<RecapRow> = {}): RecapRow => ({
  key: "1-1",
  kind: "fourniture",
  designation: "Vivace 4 L",
  quantity: 2,
  ht: 20,
  ttc: 24,
  unit: "pièce",
  purchase: {
    supplier_id: null,
    pau_ht_applied: 5,
    cost_status: "connu",
    unit_multiplier: 1,
    unit_status: "ok",
  },
  ...over,
});

const mo = (over: Partial<RecapRow> = {}): RecapRow => ({
  key: "1-2",
  kind: "mo",
  designation: "Plantation",
  quantity: 1,
  ht: 80,
  ttc: 96,
  unit: null,
  purchase: null,
  ...over,
});

describe("manualLineFields", () => {
  test("PAU saisi : achat connu, sans toucher aux autres champs", () => {
    expect(manualLineFields("fourniture", { pau: 4.5 })).toEqual({
      pau_ht_applied: 4.5,
      cost_status: "connu",
      unit_multiplier: 1,
      unit_status: "ok",
    });
  });

  test("unité saisie : multiplicateur et unité vérifiés", () => {
    expect(manualLineFields("fourniture", { multiplier: 0.5 })).toEqual({
      unit_multiplier: 0.5,
      unit_status: "ok",
    });
  });

  test("main-d'œuvre : seul le coût saisi est écrit", () => {
    expect(manualLineFields("mo", { cost: 60, pau: 3 })).toEqual({ manual_cost_ht: 60 });
  });

  test("aucune saisie : rien n'est écrit", () => {
    expect(manualLineFields("fourniture", undefined)).toEqual({});
  });
});

describe("posteRecap", () => {
  test("achat détecté : marge = PV HT − (fournitures + MO)", () => {
    const fin = posteRecap([frn(), mo({ key: "1-2" })], { "1-2": { cost: 30 } });
    // fournitures : 2 × 1 × 5 = 10 ; MO saisie 30 ; PV HT 20 + 80 = 100
    expect(fin.achatFournituresHt).toBe(10);
    expect(fin.prixAchatHt).toBe(40);
    expect(fin.pvHt).toBe(100);
    expect(fin.margeHt).toBe(60);
    expect(fin.tauxMarge).toBe(60);
    expect(fin.complete).toBe(true);
  });

  test("main-d'œuvre sans coût : 0 € accepté sur l'écran, pas d'alerte", () => {
    const fin = posteRecap([frn(), mo()], {});
    expect(fin.prixAchatHt).toBe(10);
    expect(fin.issues).toEqual([]);
    expect(fin.margeHt).toBe(90);
  });

  test("PAU absent : indicateurs à null, jamais 0", () => {
    const row = frn({ purchase: null });
    const fin = posteRecap([row], {});
    expect(fin.achatFournituresHt).toBeNull();
    expect(fin.margeHt).toBeNull();
    expect(fin.tauxMarge).toBeNull();
  });

  test("PAU saisi à la main : le calcul le prend en compte", () => {
    const fin = posteRecap([frn({ purchase: null })], { "1-1": { pau: 5, multiplier: 1 } });
    expect(fin.achatFournituresHt).toBe(10);
    expect(fin.margeHt).toBe(10);
  });
});

describe("missingFields", () => {
  test("ligne complète : rien à saisir", () => {
    expect(missingFields([frn(), mo({ key: "1-2" })], { "1-2": { cost: 10 } })).toEqual([]);
  });

  test("PAU absent : pas listé ici, il se saisit dans la ligne", () => {
    expect(missingFields([frn({ purchase: null, unit: null })], {})).toEqual([]);
  });

  test("PAU absent saisi dans la ligne : le poste est compté, unité résolue", () => {
    const rows = [frn({ purchase: null, unit: null })];
    const manual = { "1-1": { pau: 5 } };
    expect(missingFields(rows, manual)).toEqual([]);
    const fin = posteRecap(rows, manual);
    expect(fin.achatFournituresHt).toBe(10); // 2 × 1 × 5
    expect(fin.margeHt).toBe(10); // PV HT 20 − 10
    expect(fin.issues).toEqual([]);
  });

  test("unité non pièce ni kg : multiplicateur 1 par défaut, jamais bloquant", () => {
    const row = frn({
      unit: "m",
      purchase: {
        supplier_id: null,
        pau_ht_applied: 5,
        cost_status: "connu",
        unit_multiplier: null,
        unit_status: "non_verifiee",
      },
    });
    expect(missingFields([row], {})).toEqual([]);
    expect(previewStoredLine(row, undefined).unit_multiplier).toBe(1);
  });

  test("main-d'œuvre sans coût saisi : pas une information manquante (0 €)", () => {
    expect(missingFields([mo()], {})).toEqual([]);
  });
});

describe("posteClientText", () => {
  test("une ligne par fourniture, avec quantité et unité, sans prix ni main-d'œuvre", () => {
    const text = posteClientText([
      frn(),
      frn({ key: "1-3", designation: "Terreau", quantity: 3, unit: null }),
      mo({ quantity: 2, unit: null }),
    ]);
    expect(text.split("\n\n")).toEqual([
      "- Vivace 4 L\n  Quantité : 2 pièce",
      "- Terreau\n  Quantité : 3 unité à préciser",
    ]);
    expect(text.includes("€")).toBe(false);
  });
});

describe("cascadeAmounts : les colonnes communiquent", () => {
  const base = { quantity: 2, pu: 10, ht: 20, ttc: 24 };

  test("quantité modifiée : HT puis TTC recalculés", () => {
    const next = cascadeAmounts(base, {}, "quantity", 3);
    expect(next.quantity).toBe(3);
    expect(next.ht).toBe(30);
    expect(next.ttc).toBe(36);
  });

  test("PU modifié au centime : HT et TTC suivent", () => {
    const next = cascadeAmounts(base, {}, "pu", 10.05);
    expect(next.ht).toBe(20.1);
    expect(next.ttc).toBe(24.12);
  });

  test("HT modifié : PU recalculé", () => {
    const next = cascadeAmounts(base, {}, "ht", 30);
    expect(next.pu).toBe(15);
    expect(next.ttc).toBe(36);
  });

  test("TTC modifié : HT et PU recalculés", () => {
    const next = cascadeAmounts(base, {}, "ttc", 36);
    expect(next.ht).toBe(30);
    expect(next.pu).toBe(15);
  });

  test("sans taux connu : TTC non inventé", () => {
    const next = cascadeAmounts({ quantity: 2, pu: 10, ht: null, ttc: null }, {}, "quantity", 3);
    expect(next.ht).toBe(30);
    expect(next.ttc).toBe(undefined);
  });

  test("quantité saisie : entre dans le total du poste", () => {
    const rows = [frn({ quantity: 2 })];
    const manual = { "1-1": cascadeAmounts(base, {}, "quantity", 4) };
    const fin = posteRecap(rows, manual);
    expect(fin.pvHt).toBe(40);
    expect(fin.achatFournituresHt).toBe(20);
  });
});

describe("ligne sans prix d'achat : le poste se calcule quand même", () => {
  test("total porte sur les lignes renseignées, l'écart est signalé", () => {
    const fin = posteRecap([frn(), frn({ key: "1-3", purchase: null, ht: 30 })], {});
    expect(fin.achatFournituresHt).toBe(10);
    expect(fin.pvHt).toBe(50);
    expect(fin.margeHt).toBe(40);
    expect(fin.issues).toContain("Prix d'achat manquant.");
  });
});

describe("storedPosteRecap", () => {
  test("ligne enregistrée : achat et main-d'œuvre à 0 € comptés sans alerte", () => {
    const fin = storedPosteRecap([
      {
        kind: "fourniture",
        quantity: 2,
        ht: 20,
        ttc: 24,
        pau_ht_applied: 5,
        cost_status: "connu",
        unit_status: "ok",
        unit_multiplier: 1,
        manual_cost_ht: null,
        zero_cost_reason: null,
      },
      {
        kind: "mo",
        quantity: 1,
        ht: 80,
        ttc: 96,
        pau_ht_applied: null,
        cost_status: "manquant",
        unit_status: "non_verifiee",
        unit_multiplier: null,
        manual_cost_ht: null,
        zero_cost_reason: null,
      },
    ]);
    expect(fin.achatFournituresHt).toBe(10);
    expect(fin.prixAchatHt).toBe(10);
    expect(fin.margeHt).toBe(90);
    expect(fin.issues).toEqual([]);
  });
});

describe("montants saisis à la main", () => {
  test("HT et TTC saisis : remplacent ceux du devis dans les totaux", () => {
    const fin = posteRecap([frn(), mo()], { "1-1": { ht: 30, ttc: 36 }, "1-2": { cost: 10 } });
    expect(fin.pvHt).toBe(110);
    expect(fin.pvTtc).toBe(132);
  });

  test("manualLineFields : PU, HT, TTC écrits pour fournitures et main-d'œuvre", () => {
    expect(manualLineFields("mo", { ht: 50, ttc: 60, pu: 50 })).toEqual({
      pu_ht: 50,
      ht: 50,
      ttc: 60,
    });
  });
});
