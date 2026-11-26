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
  test("l'ancienne fresque supérieure est supprimée", () => {
    expect(annualTableSource).not.toContain("CA HT mensuel · résultat mensuel");
  });

  test("la fresque mensuelle conservée reçoit le résultat et le statut actif", () => {
    expect(annualTableSource).toContain("monthResultTone(row.resultat, row.nature, active)");
    expect(annualTableSource).toContain("selectedMonth");
    expect(annualTableSource).toContain("pp-month-result");
  });

  test("la fusion reste rattachée au tableau annuel", () => {
    expect(annualTableSource).toContain("pp-annual-ca-fresque");
    expect(annualTableSource).toContain("monthlyCaRows(entries, year, { now, period })");
  });
});
