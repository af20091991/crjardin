import { describe, expect, test } from "bun:test";
import { PREMIUM_NAV } from "@/components/share/PremiumNav";

describe("menu Premium", () => {
  const labels = PREMIUM_NAV.map((entry) => entry.label);
  const ids = PREMIUM_NAV.map((entry) => entry.id);

  test("navigation à plat : une rubrique = une page, sans sous-menu", () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  test("Préconisations vient juste après Interventions", () => {
    expect(labels.indexOf("Préconisations")).toBe(labels.indexOf("Interventions") + 1);
  });

  test("toutes les rubriques de contenu restent accessibles au premier niveau", () => {
    for (const id of [
      "garden",
      "reports",
      "recommendations",
      "calendar",
      "photos",
      "documents",
      "exchange",
    ]) {
      expect(ids).toContain(id as (typeof ids)[number]);
    }
  });
});
