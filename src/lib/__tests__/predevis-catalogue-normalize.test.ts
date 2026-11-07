import { describe, expect, test } from "bun:test";
import {
  findDuplicateCodes,
  isCatalogueExcluded,
  normCode,
  normDesignation,
  normUnit,
  parsePrice,
  resolvePriceConflict,
} from "../predevis-catalogue-normalize";

describe("parsePrice", () => {
  test("accepte nombre et formats français", () => {
    expect(parsePrice(0.675).value).toBe(0.675);
    expect(parsePrice("0,675").value).toBe(0.675);
    expect(parsePrice("1 234,50").value).toBe(1234.5);
    expect(parsePrice("12,5 €").value).toBe(12.5);
  });

  test("erreurs tableur et vides → prix manquant, jamais de substitution", () => {
    for (const raw of ["#DIV/0!", "#REF!", "", null, undefined, "abc"]) {
      const p = parsePrice(raw);
      expect(p.value).toBeNull();
      expect(p.status).toBe("prix_achat_manquant");
    }
  });

  test("conserve la valeur brute pour audit", () => {
    expect(parsePrice("#REF!").raw).toBe("#REF!");
  });
});

describe("normCode / normDesignation", () => {
  test("code : majuscules, sans espaces, tirets ni points", () => {
    expect(normCode(" aef 0,5 ac ")).toBe("AEF0,5AC");
    expect(normCode("pal3-4")).toBe("PAL34");
    expect(normCode("")).toBeNull();
  });

  test("désignation : conserve « professionnel » (Touchat ≠ SJ34)", () => {
    expect(normDesignation("Terreau biologique professionnel - T4")).not.toBe(
      normDesignation("Terreau biologique 40L"),
    );
    expect(normDesignation("Terreau biologique professionnel")).toContain("professionnel");
  });
});

describe("normUnit", () => {
  test("unités connues normalisées", () => {
    expect(normUnit("Pièce")).toBe("pièce");
    expect(normUnit("pièce(s)")).toBe("pièce");
    expect(normUnit("Unité")).toBe("pièce");
    expect(normUnit("Tonne")).toBe("tonne");
    expect(normUnit("m2")).toBe("m²");
  });

  test("absente ou inconnue → null (jamais devinée)", () => {
    expect(normUnit("")).toBeNull();
    expect(normUnit(undefined)).toBeNull();
    expect(normUnit("bidule")).toBeNull();
  });
});

describe("isCatalogueExcluded", () => {
  test("services et main-d'œuvre exclus", () => {
    expect(isCatalogueExcluded({ family: "Services" })).toBe(true);
    expect(isCatalogueExcluded({ designation: "Main d'oeuvre" })).toBe(true);
    expect(isCatalogueExcluded({ code: "MO1" })).toBe(true);
  });

  test("fournitures conservées", () => {
    expect(
      isCatalogueExcluded({ family: "Produits", designation: "Terre végétale", code: "TVC35" }),
    ).toBe(false);
  });
});

describe("resolvePriceConflict", () => {
  test("la valeur la plus haute gagne, quelle que soit la source", () => {
    const r = resolvePriceConflict(
      { value: 0.675, source: "excel" },
      { value: 0.68, source: "henrri" },
    );
    expect(r.value).toBe(0.68);
    expect(r.source).toBe("henrri");
    expect(r.conflict).toBe(true);
  });

  test("une baisse dans le nouvel import ne remplace pas un prix plus haut", () => {
    const r = resolvePriceConflict({ value: 10, source: "henrri" }, { value: 9, source: "excel" });
    expect(r.value).toBe(10);
  });

  test("une valeur absente ne gagne jamais", () => {
    const r = resolvePriceConflict(
      { value: 5, source: "excel" },
      { value: null, source: "henrri" },
    );
    expect(r.value).toBe(5);
    expect(r.conflict).toBe(false);
  });
});

describe("findDuplicateCodes", () => {
  test("détecte les références présentes plusieurs fois", () => {
    expect(findDuplicateCodes(["MO", "MO", "TR3", "AEF1L"])).toEqual(["MO"]);
  });
});
