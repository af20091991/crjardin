import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import { yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { buildCaBackupWorkbook } from "@/lib/pp-ca-backup-excel.server";

const base = {
  user_id: "u",
  is_fixed: false,
  position: 0,
  note: null,
  client_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function entry(
  p: Partial<CaEntry> & Pick<CaEntry, "month" | "kind" | "amount_ht">,
  i: number,
): CaEntry {
  return {
    ...base,
    id: `e${i}`,
    year: 2026,
    designation: `Ligne ${i}`,
    category: null,
    hours: null,
    sale_status: "regle",
    ...p,
  } as CaEntry;
}

describe("classeur Backup PP CA", () => {
  const options = { period: "exercice_complet" as const };
  const entries = [
    entry({ month: 1, kind: "vente", amount_ht: 1000, hours: 8, category: "SAP" }, 1),
    entry({ month: 1, kind: "vente", amount_ht: 500, hours: 4 }, 2),
    entry({ month: 1, kind: "charge", amount_ht: 200 }, 3),
    entry({ month: 2, kind: "vente", amount_ht: 750.5, hours: 5 }, 4),
    entry({ month: 2, kind: "charge", amount_ht: 100 }, 5),
    entry({ month: 2, kind: "charge", amount_ht: 999, is_investment: true }, 6),
  ];
  const previous = [{ ...entry({ month: 1, kind: "vente", amount_ht: 800 }, 7), year: 2025 }];

  test("mise en page, formules et totaux identiques à la page CA", async () => {
    const buf = await buildCaBackupWorkbook({
      year: 2026,
      monthsElapsed: 2,
      entries,
      previousEntries: previous,
      history: [{ year: 2025, ventesHt: 800, benefice: 800 }],
      options,
    });
    // Le chargement ExcelJS sous bun échoue (flux) : on inspecte le XML du zip.
    const zip = await JSZip.loadAsync(buf);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const styles = await zip.file("xl/styles.xml")!.async("string");
    const shared = await zip.file("xl/sharedStrings.xml")!.async("string");
    expect(zip.file("xl/workbook.xml")).not.toBeNull();
    // Couleurs du modèle
    for (const argb of ["FF0F9DE8", "FF92D050", "FFFFC000"])
      expect(styles.includes(argb)).toBe(true);
    for (const label of [
      "CA 2026",
      "Charges HT",
      "Détails des charges",
      "Détails des ventes",
      "Janvier",
    ])
      expect(shared.includes(label)).toBe(true);
    // Formules
    expect(sheet.includes("<f>C4-B4</f>")).toBe(true);
    expect(/<f>G\d+<\/f>/.test(sheet)).toBe(true);
    // Totaux (résultats mis en cache) = totaux de la page
    const t = yearTotals(entries, options);
    expect(t.ventesHt).toBeCloseTo(2250.5, 2);
    expect(t.chargesHt).toBeCloseTo(300, 2); // l'investissement n'est pas une charge
  });
});
