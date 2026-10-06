import { describe, expect, it } from "bun:test";
import { dailyRevenue, familyBreakdown, variationPct } from "@/lib/pilot-dashboard-views";
import type { PilotEntry } from "@/lib/pilot";

const entry = (date: string, amount: number, family: string): PilotEntry =>
  ({ entry_date: date, amount_ht: amount, family }) as unknown as PilotEntry;

describe("dashboard — vues année / mois", () => {
  it("variationPct renvoie null sans base de comparaison", () => {
    expect(variationPct(100, 0)).toBeNull();
    expect(variationPct(150, 100)).toBeCloseTo(50, 6);
    expect(variationPct(50, 100)).toBeCloseTo(-50, 6);
  });

  it("dailyRevenue cumule le CA jour par jour jusqu'à la date demandée", () => {
    const rows = dailyRevenue(
      [
        entry("2026-10-02", 100, "sap"),
        entry("2026-10-02", 50, "sap"),
        entry("2026-10-04", 30, "conseil"),
      ],
      31,
      5,
    );
    expect(rows).toHaveLength(5);
    expect(rows[1]).toEqual({ jour: "2", CA: 150, cumul: 150 });
    expect(rows[4]).toEqual({ jour: "5", CA: 0, cumul: 180 });
  });

  it("familyBreakdown exclut les familles sans CA", () => {
    const rows = familyBreakdown([entry("2026-10-02", 100, "sap"), entry("2026-10-03", 40, "sap")]);
    expect(rows).toEqual([{ name: "SAP", color: "#4F8E33", value: 140 }]);
  });
});
