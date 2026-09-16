import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const annualTableSource = readFileSync(
  join(testDir, "../../components/pilot/AnnualMonthsTable.tsx"),
  "utf8",
);

describe("présentation CA — régressions interdites", () => {
  test("le tableau annuel n'affiche plus de montant présenté comme reporté", () => {
    expect(annualTableSource).not.toContain("reporté");
    expect(annualTableSource).not.toContain("reportées");
    expect(annualTableSource).not.toContain("chargesFixesReportees");
  });
});
