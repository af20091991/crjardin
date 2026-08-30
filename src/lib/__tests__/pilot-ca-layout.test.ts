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
    expect(/className="order-[12]/.test(src)).toBe(false);
  });

  it("affiche les deux encarts verticalement à toutes les largeurs", () => {
    expect(workbenchClass).toContain("flex-col");
    expect(workbenchClass).not.toContain("lg:grid-cols-2");
    expect(workbenchClass).not.toContain("order-1");
    expect(workbenchClass).not.toContain("order-2");
  });

  it("donne toute la largeur disponible à chaque encart", () => {
    expect(src).toContain('data-testid="ca-ventes-column" className="min-w-0');
    expect(src).toContain('data-testid="ca-charges-column" className="min-w-0');
    expect(/ca-(ventes|charges)-column[\s\S]{0,120}max-w-/.test(src)).toBe(false);
  });

  it("conserve toutes les colonnes et champs de saisie Ventes", () => {
    for (const col of ["Désignation", "Montant HT", "Statut", "Client", "Catégorie", "Type", "Temps"]) {
      expect(src).toContain(col);
    }
    expect(src).toContain("<ClientPicker");
    expect(src.indexOf('defaultValue={row.amount_ht || ""}')).toBeLessThan(chargesIdx);
    expect(src.indexOf("const raw = e.target.value.trim();")).toBeLessThan(chargesIdx);
    expect(src.indexOf("save(row.id, { hours: v });")).toBeLessThan(chargesIdx);
  });

  it("conserve toutes les colonnes et champs de saisie Charges", () => {
    expect(src).toContain("Détails des charges");
    expect(src.indexOf('onClick={() => addRow("charge")')).toBeGreaterThan(ventesIdx);
    expect(src.indexOf("save(row.id, { designation: e.target.value });")).toBeGreaterThan(ventesIdx);
    expect(src.indexOf("save(row.id, { amount_ht: v });")).toBeGreaterThan(ventesIdx);
  });

  it("replie le commentaire par défaut avec une ouverture en un clic", () => {
    expect(src).toContain("const opened = !!openNote[row.id];");
    expect(src.match(/Voir le commentaire/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("conserve le réglage de densité mémorisé sans exiger un libellé UI", () => {
    expect(src).toContain("pilot-ca-density");
    expect(src).toContain('"compact"');
    expect(src).toContain("localStorage.setItem(CA_DENSITY_KEY");
  });

  it("conserve le bouton d'ajout de ligne charge", () => {
    expect(src).toContain("Détails des charges");
    expect(src).toContain('onClick={() => addRow("charge")');
  });

  it("n'a qu'une seule source de vérité pour la période (pas de sélecteur local dupliqué)", () => {
    expect(src).not.toContain("displayMode");
    expect(src).not.toContain('value="annee"');
    expect(src).not.toContain("Exercice en cours (01/01");
  });

  it("fait dépendre la navigation des mois du period global", () => {
    expect(src).toContain("period === \"exercice_complet\" || !isCurrentYear");
    expect(src).toContain("realizedMonthLimit(year, now)");
  });

  it("affiche le tableau annuel uniquement quand period vaut exercice_complet", () => {
    const idx = src.indexOf("{period === \"exercice_complet\" && (");
    expect(idx).toBeGreaterThan(0);
    expect(src.indexOf("<AnnualMonthsTable", idx)).toBeGreaterThan(idx);
  });
});
