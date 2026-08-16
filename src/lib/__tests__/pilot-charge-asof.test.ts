// Photographie financière à date : une charge du mois EN COURS sans date
// précise n'est jamais comptabilisée comme réalisée (marge non dégradée).
import { describe, expect, test } from "bun:test";
import {
  isChargeRealizedAsOf,
  isUndatableCurrentMonthCharge,
  keepRealizedCharge,
} from "@/lib/pilot-realized";

const NOW = new Date("2026-08-16T12:00:00Z");

describe("charges — photographie à date", () => {
  test("mois passé sans date : échue, donc réalisée", () => {
    expect(isChargeRealizedAsOf({ year: 2026, month: 7 }, NOW)).toBe(true);
  });

  test("mois en cours sans date : non datable, exclue", () => {
    expect(isChargeRealizedAsOf({ year: 2026, month: 8 }, NOW)).toBe(false);
    expect(isUndatableCurrentMonthCharge({ year: 2026, month: 8 }, NOW)).toBe(true);
  });

  test("mois en cours avec date passée : incluse ; date future : exclue", () => {
    expect(isChargeRealizedAsOf({ year: 2026, month: 8, entry_date: "2026-08-10" }, NOW)).toBe(true);
    expect(isChargeRealizedAsOf({ year: 2026, month: 8, entry_date: "2026-08-28" }, NOW)).toBe(false);
  });

  test("mois futur : toujours exclu", () => {
    expect(isChargeRealizedAsOf({ year: 2026, month: 12 }, NOW)).toBe(false);
  });

  test("exercice complet explicite : tout est lu", () => {
    expect(
      keepRealizedCharge({ year: 2026, month: 12 }, { now: NOW, period: "exercice_complet" }),
    ).toBe(true);
    expect(keepRealizedCharge({ year: 2026, month: 8 }, { now: NOW })).toBe(false);
  });
});
