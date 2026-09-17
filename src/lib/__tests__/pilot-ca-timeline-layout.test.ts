import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(testDir, "../../components/pilot/AnnualMonthsTable.tsx"),
  "utf8",
);

describe("fresque CA — régression de mise en page", () => {
  test("la fresque fusionnée est hors de la carte annuelle", () => {
    expect(source).toContain('data-pilot-ca-timeline="true"');
    expect(source).toContain("Fond vert = résultat positif");
    expect(source).toContain("Fond rouge = résultat négatif");
    expect(source).toContain("Vert foncé = mois actif");
  });

  test("l'ancienne navigation mensuelle est masquée pour ne laisser qu'une fresque", () => {
    expect(source).toContain("LEGACY_MONTH_NAV_SELECTOR");
    expect(source).toContain("display: none !important");
  });
});
