import { describe, expect, it } from "bun:test";
import { calcRemiseHt } from "@/lib/pilot-ca";

describe("calcRemiseHt", () => {
  it("applique la remise sur le TTC puis sort le HT au taux 20 %", () => {
    const r = calcRemiseHt(120, 10, 0.2);
    expect(r.remise).toBeCloseTo(12);
    expect(r.netTtc).toBeCloseTo(108);
    expect(r.ht).toBeCloseTo(90);
    expect(r.tva).toBeCloseTo(18);
  });

  it("utilise le taux 10 % quand il est choisi", () => {
    const r = calcRemiseHt(110, 0, 0.1);
    expect(r.ht).toBeCloseTo(100);
  });

  it("retourne zéro sans somme", () => {
    const r = calcRemiseHt(0, 15, 0.2);
    expect(r.ht).toBe(0);
  });
});
