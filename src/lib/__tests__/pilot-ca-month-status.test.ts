import { describe, expect, test } from "bun:test";
import { monthResultTone } from "@/lib/pilot-ca-month-status";

describe("monthResultTone", () => {
  test("uses light green for a beneficiary month", () => {
    expect(monthResultTone(100, "realise_a_date", false)).toBe("bg-emerald-100 text-emerald-800");
  });

  test("uses light red for a loss-making month", () => {
    expect(monthResultTone(-1, "realise_a_date", false)).toBe("bg-rose-100 text-rose-800");
  });

  test("keeps empty months neutral", () => {
    expect(monthResultTone(0, "aucun", false)).toBe("bg-muted text-muted-foreground");
  });

  test("active month keeps the dark green treatment", () => {
    expect(monthResultTone(-500, "realise_a_date", true)).toBe("bg-emerald-700 text-white");
  });
});
