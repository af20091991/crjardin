import { describe, expect, test } from "bun:test";
import {
  dedupeOfferRows,
  effectivePau,
  suppliersToCreate,
  toWriteRows,
} from "../predevis-catalogue-write";
import { buildCatalogueImport } from "../predevis-catalogue-import";

describe("suppliersToCreate", () => {
  test("ne crée que les fournisseurs confirmés, une seule fois", () => {
    const out = suppliersToCreate(["B&Fils", "P-C", "B&FILS"], ["B&Fils"]);
    expect(out).toEqual([{ name: "B&Fils", norm_name: "b&fils" }]);
  });

  test("rien n'est créé sans confirmation", () => {
    expect(suppliersToCreate(["Inconnu"], [])).toEqual([]);
  });
});

describe("toWriteRows", () => {
  const plan = buildCatalogueImport({
    source: "excel",
    rows: [
      {
        "Code produit": "H2",
        Désignation: "Arbuste",
        "PAU HT": 14.4,
        "Fournisseur 1": "SJ34, Inconnu",
      },
    ],
    knownSuppliers: new Set(["sj34"]),
  });

  test("fournisseur connu → id ; inconnu → null (jamais inventé)", () => {
    const ids = new Map([["sj34", "uuid-sj34"]]);
    const { offers } = toWriteRows(plan, ids);
    expect(offers.map((o) => [o.supplier_id, o.pau_ht])).toEqual([
      ["uuid-sj34", 14.4],
      [null, 14.4],
    ]);
  });
});

describe("effectivePau", () => {
  test("le plus haut gagne, quelle que soit la source", () => {
    expect(
      effectivePau([
        { pau_ht: 0.675, source: "excel" },
        { pau_ht: 0.68, source: "henrri" },
      ]),
    ).toEqual({ value: 0.68, source: "henrri" });
  });

  test("valeurs absentes ignorées ; tout absent → null", () => {
    expect(
      effectivePau([
        { pau_ht: null, source: "henrri" },
        { pau_ht: 3, source: "excel" },
      ]),
    ).toEqual({
      value: 3,
      source: "excel",
    });
    expect(effectivePau([{ pau_ht: null, source: "excel" }])).toEqual({
      value: null,
      source: null,
    });
  });
});

describe("dedupeOfferRows", () => {
  test("garde une offre par produit, fournisseur et source, la plus haute", () => {
    const rows = [
      { product_id: "p1", supplier_id: "s1", source: "excel", pau_ht: 2 },
      { product_id: "p1", supplier_id: "s1", source: "excel", pau_ht: 5 },
      { product_id: "p1", supplier_id: null, source: "excel", pau_ht: null },
      { product_id: "p1", supplier_id: null, source: "excel", pau_ht: 1 },
    ];
    const out = dedupeOfferRows(rows);
    expect(out.length).toBe(2);
    expect(out.find((r) => r.supplier_id === "s1")?.pau_ht).toBe(5);
    expect(out.find((r) => r.supplier_id === null)?.pau_ht).toBe(1);
  });
});
