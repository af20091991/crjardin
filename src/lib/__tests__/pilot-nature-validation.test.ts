import { describe, expect, it } from "bun:test";
import {
  naturePatch,
  needsNatureDecision,
  placementOf,
} from "@/lib/pilot-nature-validation";
import { clientCheck } from "@/lib/pilot-client-check";

describe("validation de la nature d'une ligne", () => {
  it("ne demande une décision que pour les charges non classées", () => {
    expect(needsNatureDecision({ kind: "charge", charge_class: null })).toBe(true);
    expect(needsNatureDecision({ kind: "charge", charge_class: "a_classer" })).toBe(true);
    expect(needsNatureDecision({ kind: "charge", charge_class: "fixe" })).toBe(false);
    expect(needsNatureDecision({ kind: "vente", charge_class: null })).toBe(false);
  });

  it("n'interroge jamais un investissement qualifié", () => {
    expect(needsNatureDecision({ kind: "charge", charge_class: null, is_investment: true })).toBe(
      false,
    );
  });

  it("indique l'emplacement de la ligne dans la page Chiffre d'affaires", () => {
    expect(placementOf({ kind: "vente" })).toContain("Ventes");
    expect(placementOf({ kind: "charge" })).toContain("Charges");
  });

  it("écrit une nature explicite sans jamais toucher le montant", () => {
    expect(naturePatch("vente")).toEqual({ kind: "vente", charge_class: null, is_investment: false });
    expect(naturePatch("variable")).toEqual({
      kind: "charge",
      charge_class: "variable",
      is_investment: false,
    });
    expect(naturePatch("fixe").charge_class).toBe("fixe");
  });
});

describe("colonne « À vérifier »", () => {
  const certified = "certified_client";

  it("ne signale rien quand CA et temps sont cohérents", () => {
    expect(
      clientCheck({ entityStatus: certified, ca: 5000, hours: 40, lines: 6, hourlyRate: 125 })
        .flagged,
    ).toBe(false);
  });

  it("signale un CA rattaché sans temps documenté", () => {
    const c = clientCheck({ entityStatus: certified, ca: 5000, hours: 0, lines: 3, hourlyRate: 0 });
    expect(c.flagged).toBe(true);
    expect(c.reasons.join(" ")).toContain("sans aucun temps");
  });

  it("signale un temps sans CA et un taux aberrant", () => {
    expect(
      clientCheck({ entityStatus: certified, ca: 0, hours: 12, lines: 1, hourlyRate: 0 }).flagged,
    ).toBe(true);
    expect(
      clientCheck({ entityStatus: certified, ca: 9000, hours: 1, lines: 1, hourlyRate: 9000 })
        .reasons.join(" "),
    ).toContain("hors plage plausible");
  });

  it("signale une identité économique non exploitable", () => {
    const c = clientCheck({
      entityStatus: "probable_contact",
      ca: 1000,
      hours: 10,
      lines: 2,
      hourlyRate: 100,
    });
    expect(c.flagged).toBe(true);
  });
});
