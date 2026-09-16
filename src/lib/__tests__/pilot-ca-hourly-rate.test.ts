import { describe, expect, it } from "bun:test";
import { monthlyCaHourlyRates } from "@/lib/pilot-ca-hourly-rate";
import type { CaEntry } from "@/lib/pilot-ca";

const sale = (
  id: string,
  amount_ht: number,
  hours: number,
  sale_status: CaEntry["sale_status"],
): CaEntry =>
  ({
    id,
    year: 2026,
    month: 9,
    kind: "vente",
    position: 0,
    designation: id,
    category: "AP",
    amount_ht,
    hours,
    sale_status,
  }) as CaEntry;

describe("monthlyCaHourlyRates", () => {
  it("includes every service in the default forecast and always adds management time", () => {
    const entries = [
      sale("paid", 300, 3, "regle"),
      sale("invoiced", 200, 2, "realise"),
      sale("planned", 100, 1, "planifie"),
    ];

    expect(monthlyCaHourlyRates(entries, 9, 2)).toEqual({
      previsionnel: 75,
      en_cours: 60,
    });
  });

  it("uses only paid services for En cours", () => {
    const entries = [sale("paid", 300, 0, "regle"), sale("unpaid", 900, 9, "realise")];

    expect(monthlyCaHourlyRates(entries, 9, 1).en_cours).toBe(300);
  });

  it("returns null when a mode has no denominator", () => {
    expect(monthlyCaHourlyRates([], 9, 0)).toEqual({
      previsionnel: null,
      en_cours: null,
    });
  });
});
