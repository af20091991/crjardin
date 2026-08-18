// Garde-fous de mise en page de la page Chiffre d'affaires (source vérifiée) :
// Ventes en haut, Charges en dessous, colonnes essentielles saisissables,
// commentaire repliable. Aucun montant ni calcul n'est concerné.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const src = readFileSync("src/routes/_authenticated/pilot.ca.tsx", "utf8");
const ventesIdx = src.indexOf('data-testid="ca-ventes-column"');
const chargesIdx = src.indexOf('data-testid="ca-charges-column"');

const workbenchMatch = src.match(/data-testid="ca-workbench"[\s\S]{0,400}?className={`([^`]+)`}/);
const workbenchClass = workbenchMatch?.[1] ?? "";

describe("page Chiffre d'affaires — agencement", () => {
  it("place Ventes avant Charges dans le DOM (et donc à l'écran)", () => {
    expect(ventesIdx).toBeGreaterThan(0);
    expect(chargesIdx).toBeGreaterThan(0);
    expect(ventesIdx).toBeLessThan(chargesIdx);
    // Aucune inversion visuelle par CSS : plus d'utilitaires order-*.
    expect(/className="order-[12]/.test(src)).toBe(false);
  });

  it("affiche les deux encarts verticalement à toutes les largeurs", () => {
    expect(workbenchClass).toContain("flex-col");
    expect(workbenchClass).not.toContain("lg:grid-cols-2");
    expect(workbenchClass).not.toContain("order-1");
    expect(workbenchClass).not.toContain("order-2");
  });

  it("donne toute la largeur disponible à chaque encart", () => {
    // Chaque colonne porte min-w-0 (s'adapte au conteneur flex) ; aucune
    // largeur fixe ou max-width ne restreint l'encart.
    expect(src).toContain('data-testid="ca-ventes-column" className="min-w-0');
    expect(src).toContain('data-testid="ca-charges-column" className="min-w-0');
    expect(/ca-(ventes|charges)-column[\s\S]{0,120}max-w-/.test(src)).toBe(false);
  });

  it("conserve toutes les colonnes et champs de saisie Ventes", () => {
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
    // Sélecteur de client, inputs montant/temps, actions commentaire/lien/suppression.
    expect(src).toContain("<ClientPicker");
    expect(src).toContain(
      "onBlur={(e) => { const v = num(e.target.value); if (v !== row.amount_ht) save(row.id, { amount_ht: v }); }}",
    );
    expect(src).toContain(
      "onBlur={(e) => {\n                            const raw = e.target.value.trim();",
    );
  });

  it("conserve toutes les colonnes et champs de saisie Charges", () => {
    expect(src).toContain("Détails des charges");
    expect(src).toContain('onClick={() => addRow("charge")');
    expect(src).toContain(
      'onBlur={(e) => { if (e.target.value !== (row.designation ?? "")) save(row.id, { designation: e.target.value }); }}',
    );
    expect(src).toContain(
      "onBlur={(e) => { const v = num(e.target.value); if (v !== row.amount_ht) save(row.id, { amount_ht: v }); }}",
    );
  });

  it("replie le commentaire par défaut avec une ouverture en un clic", () => {
    expect(src).toContain("const opened = !!openNote[row.id];");
    expect(src.match(/Voir le commentaire/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("propose une densité locale mémorisée pour cette page", () => {
    expect(src).toContain("pilot-ca-density");
    expect(src).toContain("Densité compacte");
  });

  it("conserve la création directe d'investissement", () => {
    expect(src).toContain("is_investment");
    expect(src).toContain('onClick={() => addRow("charge")');
  });
});
