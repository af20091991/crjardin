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
  it("uses realized or paid services and divides CA by their hours", () => {
    const entries = [
      sale("realized", 300, 1, "realise"),
      sale("paid", 300, 1, "regle"),
      sale("realized-2", 400, 1, "realise"),
      sale("planned", 1000, 10, "planifie"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBe(1000 / 3);
  });

  it("keeps zero-hour services in the CA without adding hours", () => {
    const entries = [
      sale("subcontracted", 500, 0, "regle"),
      sale("timed-1", 250, 1, "realise"),
      sale("timed-2", 250, 1, "regle"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBe(500);
  });

  it("returns null when qualifying services have no positive hours", () => {
    const entries = [
      sale("subcontracted-1", 500, 0, "regle"),
      sale("subcontracted-2", 400, null, "realise"),
    ];

    expect(monthlyCaHourlyRate(entries, 9)).toBeNull();
  });
});
