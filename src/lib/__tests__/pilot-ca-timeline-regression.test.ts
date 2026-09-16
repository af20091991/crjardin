import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const annualTableSource = readFileSync(
  join(testDir, "../../components/pilot/AnnualMonthsTable.tsx"),
  "utf8",
);

describe("fresque annuelle CA — régression de présentation", () => {
  test("la fresque affiche le CA HT mensuel et le résultat mensuel ensemble", () => {
    expect(annualTableSource).toContain("CA HT mensuel · résultat mensuel");
    expect(annualTableSource).toContain("formatEuro(r.ventesHt)");
    expect(annualTableSource).toContain("formatEuro(r.resultat)");
  });

  test("la couleur de résultat et le mois actif restent pilotés par le même statut", () => {
    expect(annualTableSource).toContain("monthResultTone(r.resultat, r.nature, active)");
    expect(annualTableSource).toContain("selectedMonth");
  });
});
