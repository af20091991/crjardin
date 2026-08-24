import { describe, expect, it } from "vitest";
import { applyAppearance, DEFAULT_APPEARANCE, FONT_STACKS } from "@/lib/appearance";

describe("typographie personnalisable", () => {
  it("ne change rien par défaut", () => {
    applyAppearance(DEFAULT_APPEARANCE);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--font-heading")).toBe("");
    expect(root.style.getPropertyValue("--font-sans")).toBe("");
    expect(root.style.getPropertyValue("--font-numeric")).toBe("");
    expect(root.getAttribute("data-font-heading")).toBeNull();
    expect(root.getAttribute("data-font-numeric")).toBeNull();
  });

  it("un choix de titres n'affecte que les titres", () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, fontHeading: "newsreader" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--font-heading")).toBe(FONT_STACKS.newsreader);
    expect(root.getAttribute("data-font-heading")).toBe("custom");
    expect(root.style.getPropertyValue("--font-sans")).toBe("");
    expect(root.style.getPropertyValue("--font-numeric")).toBe("");
  });

  it("le choix Système retire les polices du projet et revient au fallback navigateur", () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, fontBody: "system", fontNumeric: "system" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--font-sans")).toBe(FONT_STACKS.system);
    expect(root.style.getPropertyValue("--font-numeric")).toBe(FONT_STACKS.system);
    expect(FONT_STACKS.system).not.toContain("Plus Jakarta");
  });

  it("revenir sur auto nettoie les surcharges", () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, fontHeading: "syne", fontNumeric: "syne" });
    applyAppearance(DEFAULT_APPEARANCE);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--font-heading")).toBe("");
    expect(root.getAttribute("data-font-numeric")).toBeNull();
  });
});
