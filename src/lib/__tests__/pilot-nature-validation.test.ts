import { describe, expect, it } from "bun:test";
import {
  NATURE_CHOICES,
  naturePatch,
  needsNatureDecision,
  placementOf,
} from "@/lib/pilot-nature-validation";

describe("validation de la nature d'une ligne", () => {
  it("interroge les charges sans nature retenue", () => {
    expect(needsNatureDecision({ kind: "charge", charge_class: null })).toBe(true);
    expect(needsNatureDecision({ kind: "charge", charge_class: "a_classer" })).toBe(true);
    expect(needsNatureDecision({ kind: "charge", charge_class: "fixe" })).toBe(false);
  });

  it("interroge aussi les lignes de l'encart Ventes non validées", () => {
    expect(needsNatureDecision({ kind: "vente", validation_status: null })).toBe(true);
    expect(needsNatureDecision({ kind: "vente", validation_status: "valide" })).toBe(false);
  });

  it("n'interroge jamais un investissement qualifié", () => {
    expect(needsNatureDecision({ kind: "charge", charge_class: null, is_investment: true })).toBe(
      false,
    );
  });

  // Test E — les deux emplacements sont exprimés avec les deux seuls libellés.
  it("affiche l'emplacement actuel : Encart Ventes ou Encart Charges", () => {
    expect(placementOf({ kind: "vente" })).toBe("Encart Ventes");
    expect(placementOf({ kind: "charge" })).toBe("Encart Charges");
  });

  it("n'offre que trois choix : Vente / Charge variable / Charge fixe", () => {
    expect(NATURE_CHOICES).toEqual(["vente", "variable", "fixe"]);
  });

  // Test F — le classement change la nature, jamais le montant/la désignation/l'exercice.
  it("écrit une nature explicite sans jamais toucher le montant", () => {
    expect(naturePatch("vente")).toEqual({
      kind: "vente",
      charge_class: null,
      is_investment: false,
    });
    expect(naturePatch("variable")).toEqual({
      kind: "charge",
      charge_class: "variable",
      is_investment: false,
    });
    expect(naturePatch("fixe").charge_class).toBe("fixe");
    for (const n of NATURE_CHOICES) {
      const patch = naturePatch(n) as Record<string, unknown>;
      expect(Object.keys(patch).sort()).toEqual(["charge_class", "is_investment", "kind"]);
    }
  });
});
