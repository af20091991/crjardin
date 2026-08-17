// Garde-fous de mise en page de la page Chiffre d'affaires (source vérifiée) :
// Charges à gauche, Ventes à droite, colonnes essentielles saisissables,
// commentaire repliable. Aucun montant ni calcul n'est concerné.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const src = readFileSync("src/routes/_authenticated/pilot.ca.tsx", "utf8");
const chargesIdx = src.indexOf('data-testid="ca-charges-column"');
const ventesIdx = src.indexOf('data-testid="ca-ventes-column"');

describe("page Chiffre d'affaires — agencement", () => {
  it("place Charges avant Ventes dans le DOM (et donc à l'écran)", () => {
    expect(chargesIdx).toBeGreaterThan(0);
    expect(ventesIdx).toBeGreaterThan(0);
    expect(chargesIdx).toBeLessThan(ventesIdx);
    // Aucune inversion visuelle par CSS : plus d'utilitaires order-*.
    expect(/className="order-[12] min-w-0/.test(src)).toBe(false);
  });

  it("affiche les deux encarts côte à côte sur desktop et empilés sur mobile", () => {
    const grid = src.match(/data-testid="ca-workbench"[\s\S]{0,400}?className={`([^`]+)`}/);
    expect(grid).not.toBeNull();
    const cls = grid![1];
    expect(cls).toContain("grid-cols-1"); // mobile : Charges puis Ventes
    expect(cls).toContain("lg:grid-cols-2"); // ≥ 1280 px : côte à côte
  });

  it("conserve toutes les colonnes essentielles", () => {
    for (const col of [
      "Désignation",
      "Montant HT",
      "Statut",
      "Client",
      "Catégorie",
      "Type",
      "Temps",
    ]) {
      expect(src).toContain(col);
    }
  });

  it("replie le commentaire par défaut avec une ouverture en un clic", () => {
    expect(src).toContain("const opened = !!openNote[row.id];");
    expect(src.match(/Voir le commentaire/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("propose une densité locale mémorisée pour cette page", () => {
    expect(src).toContain("pilot-ca-density");
    expect(src).toContain("Densité compacte");
  });
});
