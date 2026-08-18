import { describe, expect, test } from "bun:test";
import {
  accountedSale,
  hoursCounted,
  revenueCounted,
  saleStatusOf,
} from "@/lib/pilot-sale-accounting";
import { hourlyRateFromSales, saleRateScope, saleTimeKnown } from "@/lib/pilot-sale-time";

describe("règle Facturé / Réglé", () => {
  test("statut par défaut = realise (facturé)", () => {
    expect(saleStatusOf(undefined)).toBe("realise");
    expect(saleStatusOf("inconnu")).toBe("realise");
    expect(saleStatusOf("regle")).toBe("regle");
  });

  test("temps compté dès Facturé, CA seulement à partir de Réglé", () => {
    expect(hoursCounted("planifie")).toBe(false);
    expect(hoursCounted("realise")).toBe(true);
    expect(revenueCounted("realise")).toBe(false);
    expect(revenueCounted("regle")).toBe(true);
    expect(revenueCounted("particulier")).toBe(true);
  });

  test("ligne facturée : heures conservées, CA neutralisé", () => {
    const r = accountedSale({ amount_ht: 1_000, hours: 10, sale_status: "realise" });
    expect(r.amount_ht).toBe(0);
    expect(r.hours).toBe(10);
  });

  test("ligne planifiée : ni CA ni temps (temps inconnu, pas 0 h)", () => {
    const r = accountedSale({ amount_ht: 1_000, hours: 10, sale_status: "planifie" });
    expect(r.amount_ht).toBe(0);
    expect(r.hours).toBeNull();
  });

  test("0 h documenté reste une donnée connue", () => {
    const r = accountedSale({ amount_ht: 500, hours: 0, sale_status: "regle" });
    expect(r.amount_ht).toBe(500);
    expect(r.hours).toBe(0);
    // 0 h explicitement saisi est une donnée valide, quel que soit le type.
    expect(saleTimeKnown({ hours: 0, intervention_type: "sst" })).toBe(true);
    expect(saleTimeKnown({ hours: 0 })).toBe(true);
    expect(saleTimeKnown({ hours: null })).toBe(false);
  });
});

describe("taux horaire — périmètre unique CA / Temps", () => {
  test("CA et temps proviennent des mêmes lignes retenues", () => {
    const rows = [
      { amount_ht: 1_000, hours: 10, intervention_type: "interne" },
      { amount_ht: 500, hours: 0, intervention_type: "sst" },
      { amount_ht: 300, hours: null, intervention_type: "interne" },
    ];
    const s = saleRateScope(rows);
    expect(s.hours).toBe(10);
    expect(s.ca).toBe(1_800); // couverture : toutes les lignes du périmètre
    expect(s.caTimed).toBe(1_500); // numérateur : lignes au temps documenté
    expect(s.caUntimed).toBe(300); // ligne sans temps : écartée du taux
    expect(s.linesTimed).toBe(2);
    expect(s.rate).toBe(150);
    expect(hourlyRateFromSales(rows).rate).toBe(150);
  });

  test("aucune heure documentée : taux horaire non calculable (jamais 0)", () => {
    const s = hourlyRateFromSales([{ amount_ht: 1_000, hours: null }]);
    expect(s.rate).toBeNull();
    expect(s.hours).toBe(0);
    expect(s.caUntimed).toBe(1_000);
  });

  test("uniquement des lignes à 0 h (SST) : taux non calculable", () => {
    // Le CA sous-traité est bien retenu, mais sans heure au dénominateur.
    const s = hourlyRateFromSales([{ amount_ht: 1_000, hours: 0, intervention_type: "sst" }]);
    expect(s.caTimed).toBe(1_000);
    expect(s.hours).toBe(0);
    expect(s.rate).toBeNull();
  });
});
