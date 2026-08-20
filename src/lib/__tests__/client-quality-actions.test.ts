import { describe, expect, test } from "bun:test";
import { computeClientQuality, type ClientQualityInput } from "@/lib/client-quality";
import { progressLabel, qualityActions } from "@/lib/client-quality-actions";

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

describe("client-quality-actions", () => {
  test("coordonnées manquantes : correction simple sur les bons champs", () => {
    const q = computeClientQuality(input({ caLines: 1 }), "c1");
    const coords = qualityActions(q.gaps).find((a) => a.key === "coords");
    expect(coords?.kind).toBe("simple");
    expect(coords?.fields).toEqual(["address", "phone", "email"]);
  });

  test("rapprochements ambigus : renvoi vers le Centre de contrôle", () => {
    const q = computeClientQuality(input({ interventions: 1 }), "c1");
    const actions = qualityActions(q.gaps);
    const ca = actions.find((a) => a.key === "ca");
    expect(ca?.kind).toBe("reconciliation");
    expect(ca?.control?.section).toBe("actions");
    expect(ca?.explain.length).toBeGreaterThan(10);
    expect(ca?.impact.length).toBeGreaterThan(10);
  });

  test("actions simples affichées avant les rapprochements", () => {
    const q = computeClientQuality(input({ interventions: 1 }), "c1");
    const kinds = qualityActions(q.gaps).map((a) => a.kind);
    expect(kinds[0]).toBe("simple");
  });

  test("progression : jamais « Fiche complète » s'il reste un manque", () => {
    const q = computeClientQuality(input({ interventions: 1 }), "c1");
    const actions = qualityActions(q.gaps);
    expect(progressLabel(actions)).not.toBe("Fiche complète");
    expect(progressLabel([])).toBe("Fiche complète");
    expect(progressLabel(actions)).toContain("à rapprocher");
  });
});
