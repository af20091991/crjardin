import { describe, expect, it } from "bun:test";
import { monthlyCaHourlyRates } from "@/lib/pilot-ca-hourly-rate";
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

describe("monthlyCaHourlyRates", () => {
  it("includes every service in the default forecast and always adds management time", () => {
    const entries = [
      sale("paid", 300, 3, "regle"),
      sale("invoiced", 200, 2, "realise"),
      sale("planned", 100, 1, "planifie"),
    ];

    expect(monthlyCaHourlyRates(entries, 9, 2)).toEqual({
      previsionnel: 75,
      en_cours: 100,
    });
  });

  it("uses only services with entered hours in En cours, regardless of payment status", () => {
    const entries = [
      sale("paid-no-hours", 300, null, "regle"),
      sale("timed-paid", 200, 2, "regle"),
      sale("timed-unpaid", 900, 9, "realise"),
      sale("planned-no-hours", 600, null, "planifie"),
    ];

    expect(monthlyCaHourlyRates(entries, 9, 5).en_cours).toBe(110);
  });

  it("excludes zero-hour services from the entered-hours mode", () => {
    const entries = [sale("untimed", 900, 0, "regle"), sale("timed", 100, 2, "realise")];

    expect(monthlyCaHourlyRates(entries, 9, 0).en_cours).toBe(50);
  });

  it("returns null when a mode has no denominator", () => {
    expect(monthlyCaHourlyRates([], 9, 0)).toEqual({
      previsionnel: null,
      en_cours: null,
    });

    expect(monthlyCaHourlyRates([sale("untimed", 900, null, "regle")], 9, 0).en_cours).toBeNull();
  });
});
