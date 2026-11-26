import { describe, expect, test } from "bun:test";
import { matrixToRows } from "../predevis-catalogue-matrix";
import { buildCatalogueImport } from "../predevis-catalogue-import";

// Disposition réelle de l'onglet « Produits » : titres avant l'en-tête, désignation = colonne B.
const excelMatrix: unknown[][] = [
  [undefined, undefined, undefined],
  [undefined, "Produits et prix catalogue 2023"],
  [undefined, "Arbres", "Code produit", "PAU HT", "Description", "Fournisseur 1"],
  [undefined, "Arbre C30", "A1", 40, "Arbre petite taille", "Ruiz"],
  [undefined, "Arbustes de haie", "Code produit", "PAU HT", "Description", "Fournisseur 1"],
  [undefined, "Arbuste C3 80/100", "H1", 3, "Gamme haie Ruiz", "Ruiz"],
  [undefined, "Gazon fleuri", "Ga1", "#DIV/0!", "commande 15 jours", "Touchat"],
];

describe("matrixToRows — Excel « Produits »", () => {
  const rows = matrixToRows(excelMatrix, "excel");

  test("trouve l'en-tête et lit les lignes produits", () => {
    expect(rows.map((r) => r["Code produit"])).toEqual(["A1", "Code produit", "H1", "Ga1"]);
    expect(rows[0]["Désignation"]).toBe("Arbre C30");
    expect(rows[2]["Fournisseur 1"]).toBe("Ruiz");
  });

  test("l'import garde les produits et écarte les en-têtes de section", () => {
    const plan = buildCatalogueImport({
      source: "excel",
      rows,
      knownSuppliers: new Set(["ruiz", "touchat"]),
    });
    expect(plan.products.map((p) => p.norm_code)).toEqual(["A1", "H1", "GA1"]);
    expect(plan.report.missing_price.map((m) => m.norm_code)).toEqual(["GA1"]);
  });
});

describe("matrixToRows — export Henrri", () => {
  const henrri: unknown[][] = [
    ["Liste des articles"],
    ["Référence", "Désignation", "Famille", "P.V HT", "P.A HT", "Unité"],
    ["TVC35", "Terre végétale 35L", "Produits", 4.96, 0.68, "Pièce"],
    ["MO", "Main d'oeuvre", "Services", 45, 0, ""],
  ];

  test("lit les colonnes Henrri par libellé", () => {
    const rows = matrixToRows(henrri, "henrri");
    expect(rows).toHaveLength(2);
    expect(rows[0]["P.A HT"]).toBe(0.68);
    expect(rows[0]["Unité"]).toBe("Pièce");
  });

  test("fichier sans en-tête reconnu → aucune ligne", () => {
    expect(
      matrixToRows(
        [
          ["a", "b"],
          [1, 2],
        ],
        "excel",
      ),
    ).toEqual([]);
  });
});
