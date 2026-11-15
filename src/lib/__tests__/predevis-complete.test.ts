import { describe, expect, test } from "bun:test";
import { chantierFinance, posteFinance } from "../predevis-finance";

const fourn = (ht: number, cost: number) => ({
  kind: "fourniture" as const,
  ht,
  ttc: ht * 1.2,
  costHt: cost,
  zeroCostReason: null,
});

describe("poste complet", () => {
  test("un poste sans main-d'œuvre, tout renseigné, est complet", () => {
    const f = posteFinance([fourn(100, 40), fourn(50, 20)]);
    expect(f.complete).toBe(true);
    expect(f.issues).toEqual([]);
  });

  test("un SST à 0 € n'est pas un SST saisi", () => {
    const f = posteFinance([fourn(100, 40)], { sstCostHt: 0 });
    expect(f.sstCostHt).toBeNull();
    expect(chantierFinance([f]).postesAvecSst).toBe(0);
  });
});
