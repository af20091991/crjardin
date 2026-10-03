import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FONT_STACKS } from "@/lib/appearance";

const root = readFileSync("src/routes/__root.tsx", "utf8");
const appearance = readFileSync("src/lib/appearance.tsx", "utf8");
const hrefs = [...root.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g)].map((m) => m[0]);

function families() {
  return hrefs.flatMap((href) =>
    [...href.matchAll(/family=([^&]+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ")),
  );
}

describe("budget de chargement des polices", () => {
  test("aucune feuille Google Fonts ne bloque le document initial", () => {
    expect(families()).toEqual([]);
  });

  test("les familles initiales et Premium sont chargeables à la demande", () => {
    expect(appearance).toContain("Plus Jakarta Sans:wght@400;500;600;700");
    expect(appearance).toContain("Syne:wght@400;500;600;700;800");
    expect(appearance).toContain("Newsreader:wght@400;500;600;700");
    expect(appearance).toContain("Cormorant Garamond:wght@400;500;600;700");
    expect(appearance).toContain("FONT_STACKS[choice]");
  });

  test("chaque famille du catalogue est prévue pour un chargement dynamique", () => {
    const catalogue = Object.entries(FONT_STACKS).filter(([key]) => key !== "system");
    for (const [key, stack] of catalogue) {
      const family = (stack.split(",")[0] ?? "").replace(/"/g, "").trim();
      expect(appearance).toContain(key + ": \"" + family + ":");
    }
  });

  test("le chargement dynamique conserve display=swap", () => {
    expect(appearance).toContain("&display=swap");
  });
});
