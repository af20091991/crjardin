// Garde-fou : une police proposée dans Personnalisation doit être réellement
// chargée par la page (sinon le choix reste sans effet visible), et les rôles
// (titres / texte / valeurs) doivent avoir une règle CSS qui les applique.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FONT_STACKS, FONT_OPTIONS } from "@/lib/appearance";

const rootSrc = readFileSync("src/routes/__root.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

/** Nom de famille (sans guillemets) de la première police d'une pile. */
function primaryFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").replace(/"/g, "").trim();
}

describe("catalogue typographique — chargement effectif", () => {
  it("chaque famille du catalogue est demandée à Google Fonts", () => {
    const missing: string[] = [];
    for (const [key, stack] of Object.entries(FONT_STACKS)) {
      if (key === "system") continue;
      const family = primaryFamily(stack);
      const urlName = family.replace(/ /g, "+");
      if (!rootSrc.includes(`family=${urlName}:`) && !rootSrc.includes(`family=${urlName}&`)) {
        missing.push(family);
      }
    }
    expect(missing).toEqual([]);
  });

  it("les graisses courantes (400 et 600 ou 700) sont demandées", () => {
    const weak: string[] = [];
    for (const [key, stack] of Object.entries(FONT_STACKS)) {
      if (key === "system") continue;
      const family = primaryFamily(stack);
      if (family === "Bebas Neue") continue; // famille à graisse unique
      const urlName = family.replace(/ /g, "+");
      const match = rootSrc.match(new RegExp(`family=${urlName.replace(/\+/g, "\\+")}:wght@([\\d;]+)`));
      if (!match) {
        weak.push(family);
        continue;
      }
      const weights = match[1]!.split(";");
      if (!weights.includes("400") || !(weights.includes("600") || weights.includes("700"))) {
        weak.push(family);
      }
    }
    expect(weak).toEqual([]);
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
    // Les titres couvrent aussi les surfaces shadcn (cartes, dialogues, panneaux).
    expect(css).toContain('[data-slot="dialog-title"]');
    expect(css).toContain('[data-slot="card-title"]');
  });
});
