import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { FONT_STACKS } from "@/lib/appearance";

const root = readFileSync("src/routes/__root.tsx", "utf8");
const hrefs = [...root.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g)].map((m) => m[0]);

/** Familles historiques : graisses conservées pour ne rien changer au rendu existant. */
const LEGACY = new Set(["Syne", "Plus Jakarta Sans", "Newsreader"]);

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
  test("25 familles importées, display=swap partout", () => {
    expect(families().length).toBe(25);
    for (const href of hrefs) expect(href).toContain("display=swap");
  });

  test("max 2 graisses par nouvelle famille", () => {
    for (const f of families()) {
      if (LEGACY.has(f.name)) continue;
      expect(f.weights.length).toBeLessThanOrEqual(2);
    }
  });

  test("chaque famille importée est proposée dans le catalogue", () => {
    const stacks = Object.values(FONT_STACKS).join(" ");
    for (const f of families()) expect(stacks).toContain(`"${f.name}"`);
  });
});
