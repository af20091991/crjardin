import { describe, expect, it } from "bun:test";
import { monthlyCaHourlyRate } from "@/lib/pilot-ca-hourly-rate";
import type { CaEntry } from "@/lib/pilot-ca";

const sale = (
  id: string,
  amount_ht: number,
  hours: number | null,
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

describe("monthlyCaHourlyRate", () => {
  it("calculates CA divided by hours for realized or paid services", () => {
    const entries = [
      sale("paid", 300, 1, "regle"),
      sale("realized-1", 300, 1, "realise"),
      sale("realized-2", 400, 1, "realise"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBeCloseTo(1000 / 3);
  });

  it("includes zero-hour services in CA without adding hours", () => {
    const entries = [
      sale("subcontracted", 500, 0, "regle"),
      sale("timed-1", 250, 1, "realise"),
      sale("timed-2", 250, 1, "regle"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBe(500);
  });

  it("accepts either realized/invoiced or paid status", () => {
    const entries = [
      sale("realized", 600, 2, "realise"),
      sale("paid", 400, 2, "regle"),
      sale("planned", 1000, 10, "planifie"),
      sale("other", 1000, 10, "particulier"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBe(250);
  });

  it("ignores services from another month", () => {
    const entries = [sale("september", 300, 3, "realise"), sale("october", 900, 3, "realise")];

    expect(monthlyCaHourlyRate(entries, 9)).toBe(100);
  });

  it("returns null when qualifying services have no hours", () => {
    expect(monthlyCaHourlyRate([sale("untimed", 900, null, "regle")], 9)).toBeNull();
    expect(monthlyCaHourlyRate([sale("zero", 900, 0, "realise")], 9)).toBeNull();
  });

  it("returns null when there are no qualifying services", () => {
    expect(
      monthlyCaHourlyRate(
        [
          sale("planned", 900, 3, "planifie"),
          sale("other", 900, 3, "particulier"),
        ],
        9,
      ),
    ).toBeNull();
  });
});
