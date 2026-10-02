// Garde-fou : une police proposée dans Personnalisation doit être réellement
// chargée par la page (sinon le choix reste sans effet visible), et les rôles
// (titres / texte / valeurs) doivent avoir une règle CSS qui les applique.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FONT_STACKS, FONT_OPTIONS } from "@/lib/appearance";

const rootSrc = readFileSync("src/routes/__root.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const appearanceSrc = readFileSync("src/lib/appearance.tsx", "utf8");

/** Nom de famille (sans guillemets) de la première police d'une pile. */
function primaryFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").replace(/"/g, "").trim();
}

describe("catalogue typographique — chargement effectif", () => {
  it("les polices du rendu par défaut sont chargées au démarrage", () => {
    expect(rootSrc).toContain("family=Syne:");
    expect(rootSrc).toContain("family=Plus+Jakarta+Sans:");
    expect(rootSrc).toContain("family=Cormorant+Garamond:");
    expect(rootSrc).toContain("family=Newsreader:");
  });

  it("les familles de personnalisation sont chargées à la demande", () => {
    expect(appearanceSrc).toContain("ensureGoogleFontLoaded");
    expect(appearanceSrc).toContain("FONT_STACKS[choice]");
    expect(appearanceSrc).toContain('https://fonts.googleapis.com/css2?family=');
    expect(appearanceSrc).toContain('link.dataset.ppFont = family');
  });

  it("les graisses courantes restent disponibles pour les polices personnalisées", () => {
    expect(appearanceSrc).toContain('family === "Bebas Neue" ? "400"');
    expect(appearanceSrc).toContain('family === "Syne" ? "400;500;600;700;800"');
    expect(appearanceSrc).toContain('"400;500;600;700"');
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
