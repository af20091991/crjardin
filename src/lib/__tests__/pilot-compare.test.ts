import { describe, expect, test } from "bun:test";
import { monthVsSameMonthLastYear, toDateVsSameDateLastYear } from "@/lib/pilot-compare";

const ROWS = [
  { entry_date: "2024-03-15", amount_ht: 1_000 },
  { entry_date: "2023-03-15", amount_ht: 800 },
  { entry_date: "2023-09-15", amount_ht: 5_000 },
];

describe("comparaisons de période", () => {
  test("mois N vs même mois N-1", () => {
    const c = monthVsSameMonthLastYear(ROWS, 2024, 2);
    expect(c.current).toBe(1_000);
    expect(c.previous).toBe(800);
    expect(c.deltaEuro).toBe(200);
    expect(c.deltaPct).toBeCloseTo(25, 6);
    expect(c.available).toBe(true);
    expect(c.label).toBe("mars 2024 vs mars 2023");
  });

  test("aucune référence N-1 : pourcentage non calculable, jamais 0 %", () => {
    const c = monthVsSameMonthLastYear([{ entry_date: "2024-04-15", amount_ht: 500 }], 2024, 3);
    expect(c.previous).toBe(0);
    expect(c.deltaPct).toBeNull();
    expect(c.available).toBe(true);
  });

  test("aucune donnée sur les deux périodes : comparaison indisponible", () => {
    const c = monthVsSameMonthLastYear([], 2024, 5);
    expect(c.available).toBe(false);
    expect(c.current).toBe(0);
    expect(c.deltaPct).toBeNull();
  });

  test("cumul au jour J vs même date N-1 (le CA postérieur est exclu)", () => {
    const c = toDateVsSameDateLastYear(ROWS, new Date("2024-06-30T12:00:00Z"));
    expect(c.current).toBe(1_000);
    expect(c.previous).toBe(800); // septembre 2023 hors périmètre à date
    expect(c.deltaPct).toBeCloseTo(25, 6);
  });

  test("lignes de date invalide ignorées sans faire échouer le calcul", () => {
    const c = monthVsSameMonthLastYear(
      [...ROWS, { entry_date: "date-invalide", amount_ht: 9_999 }],
      2024,
      2,
    );
    expect(c.current).toBe(1_000);
  });
});
