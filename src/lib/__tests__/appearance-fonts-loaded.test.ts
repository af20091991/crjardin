// Garde-fou : les polices du catalogue restent disponibles sans les télécharger
// toutes au premier affichage. Les familles personnalisées sont demandées à la volée.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FONT_STACKS, FONT_OPTIONS } from "@/lib/appearance";

const rootSrc = readFileSync("src/routes/__root.tsx", "utf8");
const appearanceSrc = readFileSync("src/lib/appearance.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

function primaryFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").replace(/"/g, "").trim();
}

describe("catalogue typographique — chargement effectif", () => {
  it("le document racine ne contient plus de feuilles Google Fonts globales", () => {
    expect(rootSrc).not.toContain("fonts.googleapis.com/css2?");
  });

  it("les familles par défaut sont définies dans le chargeur différé", () => {
    expect(appearanceSrc).toContain("Plus Jakarta Sans:wght@400;500;600;700");
    expect(appearanceSrc).toContain("Syne:wght@400;500;600;700;800");
    expect(appearanceSrc).toContain("Newsreader:wght@400;500;600;700");
    expect(appearanceSrc).toContain("Cormorant Garamond:wght@400;500;600;700");
  });

  it("les familles de personnalisation sont chargées à la demande", () => {
    expect(appearanceSrc).toContain("GOOGLE_FONT_FAMILY");
    expect(appearanceSrc).toContain("GOOGLE_FONT_FAMILY");
    expect(appearanceSrc).toContain("https://fonts.googleapis.com/css2?");
    expect(appearanceSrc).toContain('link.rel = "stylesheet"');
  });

  it("chaque option du sélecteur possède une pile de polices", () => {
    for (const opt of FONT_OPTIONS) {
      if (opt.value === "auto") continue;
      expect(primaryFamily(FONT_STACKS[opt.value]).length).toBeGreaterThan(0);
    }
  });

  it("les trois rôles disposent d'une règle CSS d'application", () => {
    expect(css).toContain('html[data-font-heading="custom"]');
    expect(css).toContain('html[data-font-body="custom"]');
    expect(css).toContain('html[data-font-numeric="custom"]');
    expect(css).toContain('[data-slot="dialog-title"]');
    expect(css).toContain('[data-slot="card-title"]');
  });
});
