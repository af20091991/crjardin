import { describe, expect, it } from "bun:test";
import { canonicalPrestation, effectiveCategory } from "@/lib/pilot-ca-designation";

describe("prestation canonique — code AP écrit seul", () => {
  it("classe en AP les désignations portant le code AP, avant ou après le nom", () => {
    expect(canonicalPrestation("AP Mesuré")).toBe("AP");
    expect(canonicalPrestation("Thouvenin AP")).toBe("AP");
    expect(canonicalPrestation("Lopez AP 2/3")).toBe("AP");
    expect(canonicalPrestation("AP d'Aboville")).toBe("AP");
  });

  it("ne confond pas AP avec un mot qui le contient", () => {
    expect(canonicalPrestation("Papin")).toBe("Autre");
    expect(canonicalPrestation("Chapelle")).toBe("Autre");
  });

  it("garde la priorité aux codes CEEV et SAP explicites", () => {
    expect(canonicalPrestation("Dupont CEEV AP")).toBe("CEEV");
    expect(canonicalPrestation("SAP Martin")).toBe("SAP");
  });
});

describe("catégorie effective", () => {
  it("la catégorie enregistrée prime, sinon la désignation, sinon Autre", () => {
    expect(effectiveCategory("Sandaya", "CEEV")).toBe("CEEV");
    expect(effectiveCategory("AP Mesuré", null)).toBe("AP");
    expect(effectiveCategory("Sandaya", null)).toBe("Autre");
  });

  it("rattache la remise en état d'un particulier à SAP", () => {
    expect(effectiveCategory("REE Martin", null)).toBe("SAP");
  });
});

import { effectiveCategory as eff } from "@/lib/pilot-ca-designation";
describe("décisions validées — agrégats 2020 et abattage", () => {
  it("classe les agrégats mensuels 2020 en SAP", () => {
    expect(eff("Ventes HT Novembre 2020 (agrégat mensuel)", null)).toBe("SAP");
  });
  it("classe l'abattage en AP", () => {
    expect(eff("Abattage Condorcet", null)).toBe("AP");
  });
});
