import { describe, expect, it } from "bun:test";
import {
  isElementShown,
  resolveChoice,
  withChoice,
  withElement,
  type CardPrefsState,
} from "@/lib/pilot-dashboard-card-prefs";

const empty: CardPrefsState = { overrides: {}, choices: {} };

describe("dashboard — préférences d'encart", () => {
  it("affiche un élément par défaut, sauf choix contraire", () => {
    expect(isElementShown(empty, "a")).toBe(true);
    expect(isElementShown(empty, "a", false)).toBe(false);
    expect(isElementShown(withElement(empty, "a", false), "a")).toBe(false);
    expect(isElementShown(withElement(empty, "a", true), "a", false)).toBe(true);
  });

  it("ne retient un type de graphique que s'il est autorisé", () => {
    const allowed = ["barres", "lignes"];
    expect(resolveChoice(empty, "c", allowed, "barres")).toBe("barres");
    expect(resolveChoice(withChoice(empty, "c", "lignes"), "c", allowed, "barres")).toBe("lignes");
    expect(resolveChoice(withChoice(empty, "c", "radar"), "c", allowed, "barres")).toBe("barres");
  });
});
