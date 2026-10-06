import { describe, expect, it } from "vitest";
import {
  buildClientPrestationMap,
  canonicalPrestation,
  PRESTATIONS,
} from "@/lib/pilot-ca-designation";

describe("référentiel prestations (4 familles validées)", () => {
  it("ne contient que SAP, AP, CEEV, Conseil", () => {
    expect(PRESTATIONS).toEqual(["SAP", "AP", "CEEV", "Conseil"]);
  });

  it("reconnaît le token AP explicite, sans confondre avec SAP", () => {
    expect(canonicalPrestation("AP Guirand", null)).toBe("AP");
    expect(canonicalPrestation("Thouvenin AP", null)).toBe("AP");
    expect(canonicalPrestation("Maxime SAP", null)).toBe("SAP");
  });

  it("classe les codes CEEV/SAP et le REE selon la règle métier", () => {
    expect(canonicalPrestation("Adagios CEEV", null)).toBe("CEEV");
    expect(canonicalPrestation("REE Dupont", null)).toBe("SAP"); // particulier
    expect(canonicalPrestation("REE Résidence Les Pins", null)).toBe("AP"); // pro
  });

  it("classe les travaux (élagage, conception, acompte) en AP", () => {
    expect(canonicalPrestation("Élagage Tourterelles", null)).toBe("AP");
    expect(canonicalPrestation("Conception Radouane", null)).toBe("AP");
    expect(canonicalPrestation("Acompte Firminhac", null)).toBe("AP");
  });

  it("classe les agrégats mensuels 2020 en SAP (décision dirigeant)", () => {
    expect(canonicalPrestation("Ventes HT Novembre 2020 (agrégat mensuel)", null)).toBe("SAP");
  });

  it("applique les correspondances clients validées", () => {
    expect(canonicalPrestation("Sandaya", null)).toBe("AP");
    expect(canonicalPrestation("Gestare", null)).toBe("AP");
    expect(canonicalPrestation("Art'Campus", null)).toBe("CEEV");
    expect(canonicalPrestation("Sysco France", null)).toBe("CEEV");
    expect(canonicalPrestation("Youbee x3", null)).toBe("CEEV");
  });

  it("déduit la prestation du client via buildClientPrestationMap", () => {
    const map = buildClientPrestationMap([
      { designation: "Tourterelles CEEV", category: null },
      { designation: "Dupré SAP", category: null },
    ]);
    expect(canonicalPrestation("Tourterelles", null, map)).toBe("CEEV");
    expect(canonicalPrestation("Dupré", null, map)).toBe("SAP");
  });

  it("retourne « Autre » (à vérifier) uniquement sans aucun indice", () => {
    expect(canonicalPrestation("Vente Jumpy", null)).toBe("Autre");
    expect(canonicalPrestation("Schena 1/2", null)).toBe("Autre");
  });
});
