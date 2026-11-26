import { describe, expect, test } from "bun:test";
import { prixCiblePourTaux } from "../predevis-finance";

describe("prixCiblePourTaux", () => {
  test("prix de revient + SST, majoré pour atteindre le taux cible", () => {
    // coût 2 823,20 € ; cible 15 % → 2 823,20 ÷ 0,85 = 3 321,41 €
    expect(prixCiblePourTaux(2033.2, 790)).toBe(3321.41);
  });
  test("pas de prix sans SST ni prix de revient connus", () => {
    expect(prixCiblePourTaux(2033.2, null)).toBeNull();
    expect(prixCiblePourTaux(null, 790)).toBeNull();
  });
});
