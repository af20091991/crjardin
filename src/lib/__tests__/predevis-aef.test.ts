import { describe, expect, test } from "bun:test";
import { parseAefRows, potKey } from "../predevis-catalogue-aef";
import { uniqueSupplierPurchase } from "../predevis-lines";

describe("potKey : taille comparable entre AEF et nos produits", () => {
  test("pots anti-chignon et simples", () => {
    expect(potKey("Vivace 1,4L A-C AEF")).toBe("1.4LAC");
    expect(potKey("1, 4L anti-chignon")).toBe("1.4LAC");
    expect(potKey("Vivace 0,5L A-C AEF")).toBe("0.5LAC");
    expect(potKey("Vivace 1L AEF")).toBe("1L");
    expect(potKey("5LAEF")).toBe("5L");
    expect(potKey("3L")).toBe("3L");
  });
  test("taille inconnue ou non litre : null, jamais devinée", () => {
    expect(potKey("Inconnu")).toBeNull();
    expect(potKey("Godet 8 cm")).toBeNull();
    expect(potKey(null)).toBeNull();
  });
});

describe("parseAefRows", () => {
  const matrix: unknown[][] = [
    ["L’ARC EN FLEURS"],
    ["Plante (A–Z)", "Stock disponible", "Taille de pot", "Prix pro HT (€)", "ID WooCommerce"],
    ["Abelia grandiflora, Abélia", 10, "3L", 6.82, 71213],
    ["Acer campestre", 0, "Inconnu", "", 99],
    ["Acanthus mollis", 2, "1.4L anti-chignon", 3.76, ""],
  ];
  test("lit les espèces avec prix et écarte les lignes sans prix", () => {
    const { rows, skipped } = parseAefRows(matrix);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      species: "Abelia grandiflora, Abélia",
      size: "3L",
      sizeKey: "3L",
      proPriceHt: 6.82,
      wooId: "71213",
    });
    expect(rows[1]?.sizeKey).toBe("1.4LAC");
    expect(rows[1]?.wooId).toBeNull();
  });
  test("en-tête absent : aucune ligne", () => {
    expect(parseAefRows([["autre"]]).rows).toEqual([]);
  });
});

describe("prix AEF prioritaire sur Henrri pour le produit", () => {
  test("offre AEF choisie : son prix est appliqué", () => {
    const r = uniqueSupplierPurchase(
      [
        { supplier_id: "h", source: "henrri", pau_ht: 3.8 },
        { supplier_id: "a", source: "aef", pau_ht: 2.5 },
      ],
      "pièce",
    );
    expect(r?.pau_ht_applied).toBe(2.5);
  });
  test("sans offre AEF : Henrri reste prioritaire", () => {
    const r = uniqueSupplierPurchase(
      [
        { supplier_id: "h", source: "henrri", pau_ht: 3.8 },
        { supplier_id: "x", source: "excel", pau_ht: 4.2 },
      ],
      "pièce",
    );
    expect(r?.pau_ht_applied).toBe(3.8);
  });
});
