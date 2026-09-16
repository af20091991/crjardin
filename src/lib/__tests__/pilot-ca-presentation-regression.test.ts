import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const annualTableSource = readFileSync(
  join(testDir, "../../components/pilot/AnnualMonthsTable.tsx"),
  "utf8",
);

// Ces tests verrouillent les deux regressions d'affichage les plus sensibles.
describe("présentation CA — régressions interdites", () => {
  test("le tableau annuel n'affiche plus de montant présenté comme reporté", () => {
    expect(annualTableSource).not.toContain("reporté");
    expect(annualTableSource).not.toContain("reportées");
    expect(annualTableSource).not.toContain("chargesFixesReportees");
  });

  test("le masquage des investissements reste disponible", () => {
    expect(annualTableSource).toContain("Masquer investissements");
    expect(annualTableSource).toContain("Afficher investissements");
  });
});
