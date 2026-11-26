import { describe, expect, test } from "bun:test";
import { buildCatalogueImport, splitSupplierNames } from "../predevis-catalogue-import";

const known = new Set(["sj34", "p-c", "ruiz", "touchat", "aef"]);

describe("splitSupplierNames", () => {
  test("découpe les fournisseurs multiples", () => {
    expect(splitSupplierNames("SJ34, P-C, Ruiz")).toEqual(["SJ34", "P-C", "Ruiz"]);
    expect(splitSupplierNames("SJ34 et Ruiz")).toEqual(["SJ34", "Ruiz"]);
    expect(splitSupplierNames(undefined)).toEqual([]);
  });
});

describe("import Excel « Produits »", () => {
  const rows = [
    { "Code produit": "Code produit", Désignation: "Arbustes", "PAU HT": "" },
    {
      "Code produit": "TVC35",
      Désignation: "Terre végétale 35L",
      "PAU HT": 0.675,
      Description: "Conteneur 35L",
      "Fournisseur 1": "B&Fils",
    },
    {
      "Code produit": "T4",
      Désignation: "Terreau biologique professionnel",
      "PAU HT": "#REF!",
      "Fournisseur 1": "Touchat",
    },
    {
      "Code produit": "H2",
      Désignation: "Arbuste de haie",
      "PAU HT": 14.4,
      "Fournisseur 1": "SJ34, P-C, Ruiz",
    },
    { "Code produit": "MO1", Désignation: "Main d'oeuvre", "PAU HT": 0 },
    { "Code produit": "", Désignation: "Sans code", "PAU HT": 1 },
  ];

  const plan = buildCatalogueImport({ source: "excel", rows, knownSuppliers: known });

  test("en-têtes de section et MO exclus", () => {
    expect(plan.report.excluded.map((e) => e.reason)).toEqual(["service_ou_mo", "sans_reference"]);
  });

  test("un prix manquant est signalé, jamais estimé", () => {
    const t4 = plan.offers.find((o) => o.norm_code === "T4");
    expect(t4?.pau_ht).toBeNull();
    expect(plan.report.missing_price.map((m) => m.norm_code)).toEqual(["T4"]);
  });

  test("une offre par fournisseur listé", () => {
    const h2 = plan.offers.filter((o) => o.norm_code === "H2").map((o) => o.supplier_name);
    expect(h2).toEqual(["SJ34", "P-C", "Ruiz"]);
    expect(plan.offers.filter((o) => o.norm_code === "H2").every((o) => o.pau_ht === 14.4)).toBe(
      true,
    );
  });

  test("fournisseur inconnu remonté", () => {
    expect(plan.report.unknown_suppliers).toEqual(["B&Fils"]);
  });

  test("description conservée", () => {
    expect(plan.products.find((p) => p.norm_code === "TVC35")?.description).toBe("Conteneur 35L");
  });
});

describe("import export Henrri", () => {
  const rows = [
    {
      Référence: "TVC35",
      Désignation: "Terre végétale 35L",
      Famille: "Produits",
      "P.A HT": 0.68,
      Unité: "Pièce",
    },
    { Référence: "MO", Désignation: "Main d'oeuvre", Famille: "Services", "P.A HT": 0 },
    { Référence: "GEO", Désignation: "geotex", Famille: "Produits", "P.A HT": 0, Unité: "" },
    { Référence: "DUP", Désignation: "A", Famille: "Produits", "P.A HT": 1 },
    { Référence: "DUP", Désignation: "B", Famille: "Produits", "P.A HT": 2 },
  ];

  test("unité normalisée, service exclu, doublons écartés", () => {
    const plan = buildCatalogueImport({ source: "henrri", rows, knownSuppliers: known });
    expect(plan.products.map((p) => p.norm_code)).toEqual(["TVC35", "GEO"]);
    expect(plan.products[0].unit).toBe("pièce");
    expect(plan.products[1].unit).toBeNull();
    expect(plan.report.duplicates).toEqual(["DUP"]);
    expect(plan.report.excluded.map((e) => e.reason)).toEqual(["service_ou_mo"]);
  });

  test("sans fournisseur Excel, fournisseur non précisé", () => {
    const plan = buildCatalogueImport({ source: "henrri", rows, knownSuppliers: known });
    expect(plan.offers.find((o) => o.norm_code === "TVC35")?.supplier_name).toBeNull();
  });

  test("rattaché au fournisseur Excel si celui-ci existe pour le produit", () => {
    const plan = buildCatalogueImport({
      source: "henrri",
      rows,
      knownSuppliers: known,
      existingOffers: [
        { norm_code: "TVC35", supplier_name: "B&Fils", source: "excel", pau_ht: 0.675 },
      ],
    });
    const offer = plan.offers.find((o) => o.norm_code === "TVC35");
    expect(offer?.supplier_name).toBe("B&Fils");
    expect(plan.report.conflicts).toEqual([
      {
        norm_code: "TVC35",
        supplier_name: "B&Fils",
        kept: { source: "henrri", value: 0.68 },
        other: { source: "excel", value: 0.675 },
      },
    ]);
  });
});
