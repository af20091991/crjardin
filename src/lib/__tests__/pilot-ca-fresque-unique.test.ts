import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(testDir, "../../components/pilot/AnnualMonthsTable.tsx"),
  "utf8",
);

describe("fresque mensuelle unique", () => {
  test("combine le CA mensuel et le résultat", () => {
    expect(source).toContain("CA HT mensuel · résultat mensuel");
    expect(source).toContain("formatEuro(r.ventesHt)");
    expect(source).toContain("formatEuro(r.resultat)");
  });

  test("conserve la priorité visuelle du mois actif", () => {
    expect(source).toContain("monthResultTone(r.resultat, r.nature, active)");
  });

  test(
    "supprime la seconde navigation visuelle et conserve son action via la fresque",
    () => {
      expect(source).toContain(".pp-annual-ca-fresque + div:has(> div > button)");
      expect(source).toContain("buttons?.[month - 1]?.click()");
    },
  );
});
