import { describe, expect, test } from "bun:test";
import { PREMIUM_NAV } from "@/components/share/PremiumNav";

describe("menu Premium", () => {
  const labels = PREMIUM_NAV.map((entry) => entry.label);

  test("Préconisations vient juste après Les interventions", () => {
    expect(labels.indexOf("Préconisations")).toBe(labels.indexOf("Les interventions") + 1);
  });

  test("« Photos et Documents » regroupe Photos, Documents et Calendrier travaux", () => {
    const group = PREMIUM_NAV.find((entry) => entry.label === "Photos et Documents");
    expect(group && "children" in group ? group.children.map((c) => c.label) : []).toEqual([
      "Photos",
      "Documents",
      "Calendrier travaux",
    ]);
  });

  test("Photos n'est plus au premier niveau du menu", () => {
    expect(labels).not.toContain("Photos");
    expect(labels).not.toContain("Documents");
  });
});
