import { describe, expect, it } from "bun:test";
import { canonicalPrestation } from "@/lib/pilot-ca-designation";

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
