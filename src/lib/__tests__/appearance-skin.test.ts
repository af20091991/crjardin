// Bascule apparence actuelle / moderne : réversible et persistée localement.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_APPEARANCE } from "@/lib/appearance";

describe("apparence — bascule classic / modern", () => {
  it("démarre sur l'apparence actuelle", () => {
    expect(DEFAULT_APPEARANCE.skin).toBe("classic");
  });

  it("persiste le choix et l'expose au shell via data-skin", () => {
    const src = readFileSync("src/lib/appearance.tsx", "utf8");
    expect(src).toContain('root.setAttribute("data-skin", a.skin)');
    expect(src).toContain("localStorage.setItem(STORAGE_KEY");
    expect(src).toContain("localStorage.removeItem(STORAGE_KEY"); // retour arrière
  });

  it("refond réellement le shell et les pages en apparence moderne", () => {
    const css = readFileSync("src/styles.css", "utf8");
    for (const hook of [
      '[data-skin="modern"] [data-shell="nav"]',
      '[data-skin="modern"] [data-shell="main"]',
      '[data-skin="modern"] table thead th',
      '[data-skin="modern"] [data-readiness="non_requis"]',
    ]) {
      expect(css).toContain(hook);
    }
  });
});
