import { describe, expect, test } from "bun:test";
import { monthResultTone } from "@/lib/pilot-ca-month-status";

describe("monthResultTone", () => {
  test("uses brand green with a readable translucent background for a beneficiary month", () => {
    expect(monthResultTone(100, "realise_a_date", false)).toBe(
      "bg-[color-mix(in_oklab,#4AAC33_18%,transparent)] text-[#4F8E33]",
    );
  });

  test("uses brand orange with a readable translucent background for a loss-making month", () => {
    expect(monthResultTone(-1, "realise_a_date", false)).toBe(
      "bg-[color-mix(in_oklab,#EE8627_18%,transparent)] text-[#EE8627]",
    );
  });

  test("keeps empty months neutral", () => {
    expect(monthResultTone(0, "aucun", false)).toBe("bg-muted text-muted-foreground");
  });

  test("active month keeps the dark green treatment", () => {
    expect(monthResultTone(-500, "realise_a_date", true)).toBe("bg-[#4F8E33] text-white");
  });
});
