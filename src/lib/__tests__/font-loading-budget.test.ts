import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FONT_STACKS } from "@/lib/appearance";

const root = readFileSync("src/routes/__root.tsx", "utf8");
const appearance = readFileSync("src/lib/appearance.tsx", "utf8");
const hrefs = [...root.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g)].map((m) => m[0]);

const INITIAL = new Set(["Syne", "Plus Jakarta Sans", "Cormorant Garamond", "Newsreader"]);

function families() {
  const out: { name: string; weights: string[] }[] = [];
  for (const href of hrefs) {
    for (const m of href.matchAll(/family=([^&]+)/g)) {
      const [name, spec] = m[1].split(":");
      const weights = (spec?.replace("wght@", "") ?? "400").split(";");
      out.push({ name: decodeURIComponent(name).replace(/\+/g, " "), weights });
    }
  }
  return out;
}

describe("budget de chargement des polices", () => {
  test("seules les familles nécessaires au rendu initial sont importées", () => {
    expect(families().length).toBe(INITIAL.size);
    for (const family of INITIAL) {
      expect(families().some((f) => f.name === family)).toBe(true);
    }
    for (const href of hrefs) expect(href).toContain("display=swap");
  });

  test("les familles de personnalisation restent chargeables à la demande", () => {
    const catalogue = Object.keys(FONT_STACKS).filter((key) => key !== "system");
    expect(catalogue.length).toBeGreaterThan(INITIAL.size);
    expect(appearance).toContain("ensureGoogleFontLoaded");
    expect(appearance).toContain("FONT_STACKS[choice]");
    expect(appearance).toContain("link.dataset.ppFont = family");
  });

  test("max 5 graisses par famille initiale", () => {
    for (const f of families()) {
      expect(f.weights.length <= 5).toBe(true);
    }
  });

  test("chaque famille initiale est proposée dans le catalogue", () => {
    const stacks = Object.values(FONT_STACKS).join(" ");
    for (const f of families()) expect(stacks).toContain(`"${f.name}"`);
  });
});
