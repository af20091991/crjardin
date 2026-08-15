// Qualité des fiches clients — fonction pure utilisée par buildDataQualityReport.
import { describe, expect, test } from "bun:test";
import { computeClientQuality, type ClientQualityInput } from "@/lib/client-quality";

function input(over: Partial<ClientQualityInput> = {}): ClientQualityInput {
  return {
    hasAddress: false,
    hasPhone: false,
    hasEmail: false,
    caLines: 0,
    caAmount: 0,
    interventions: 0,
    interventionsWithHours: 0,
    ceev: 0,
    sst: 0,
    historicHours: 0,
    recommendations: 0,
    confidenceLevel: null,
    lastQualifiedAt: null,
    ...over,
  };
}

describe("computeClientQuality", () => {
  test("fiche vide : aucune donnée, complétude 0, confiance non évaluée", () => {
    const q = computeClientQuality(input(), "c1");
    expect(q.completeness).toBe(0);
    expect(q.hasAnyData).toBe(false);
    expect(q.level).toBe("a_verifier");
    expect(q.confidenceLabel).toBe("non évaluée");
    expect(q.attachedCount).toBe(0);
  });

  test("fiche complète : qualité excellente et aucun manque", () => {
    const q = computeClientQuality(
      input({
        hasAddress: true,
        hasPhone: true,
        caLines: 3,
        caAmount: 5_000,
        interventions: 2,
        interventionsWithHours: 2,
        ceev: 1,
        recommendations: 1,
        confidenceLevel: "HIGH",
      }),
      "c1",
    );
    expect(q.completeness).toBe(100);
    expect(q.level).toBe("excellente");
    expect(q.confidenceLabel).toBe("élevée");
    expect(q.gaps).toEqual([]);
  });

  test("temps connu uniquement via Vente → Temps (historique exclu du score)", () => {
    const withHistoric = computeClientQuality(input({ caLines: 1, historicHours: 120 }), "c1");
    const withSaleTime = computeClientQuality(input({ caLines: 1, interventionsWithHours: 1 }), "c1");
    expect(withSaleTime.completeness).toBeGreaterThan(withHistoric.completeness);
    expect(withHistoric.hasAnyData).toBe(true);
  });

  test("interventions sans temps documenté : manque explicite", () => {
    const q = computeClientQuality(input({ caLines: 2, interventions: 1 }), "c1");
    expect(q.gaps.map((g) => g.key)).toContain("hours");
  });

  test("client sans compte-rendu : l'absence d'intervention n'est pas un défaut", () => {
    const q = computeClientQuality(
      input({ caLines: 2, interventionsWithHours: 1, reportPolicy: "non" }),
      "c1",
    );
    expect(q.gaps.map((g) => g.key)).not.toContain("interv");
  });

  test("aucune ligne CA : rapprochement proposé comme correction", () => {
    const q = computeClientQuality(input({ interventions: 1 }), "c1");
    expect(q.gaps.map((g) => g.key)).toContain("ca");
    expect(q.gaps.find((g) => g.key === "coords")?.to).toBe("/clients/c1");
  });
});
