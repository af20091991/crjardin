// Nouvelle interface : bascule de tokens via data-theme, persistée et réversible.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_APPEARANCE } from "@/lib/appearance";

describe("nouvelle interface — bascule data-theme", () => {
  it("démarre sur l'ancien jeu de tokens", () => {
    expect(DEFAULT_APPEARANCE.ui).toBe("legacy");
  });

  it("expose le choix sur <html> et le persiste", () => {
    const src = readFileSync("src/lib/appearance.tsx", "utf8");
    expect(src).toContain('root.setAttribute("data-theme", a.ui)');
    expect(src).toContain("localStorage.setItem(STORAGE_KEY");
  });

  it("ne change que des tokens partagés", () => {
    const css = readFileSync("src/styles.css", "utf8");
    for (const hook of [
      '[data-theme="next"] {',
      "--font-numeric",
      '[data-theme="next"] table thead th',
      '[data-theme="next"] .bg-card',
    ]) {
      expect(css).toContain(hook);
    }
  });
});
