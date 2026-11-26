import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import { yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { buildCaBackupWorkbook, buildYearModel } from "@/lib/pp-ca-backup-excel.server";

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
  year: number,
  p: Partial<CaEntry> & Pick<CaEntry, "month" | "kind" | "amount_ht">,
  i: number,
): CaEntry {
  return {
    ...base,
    id: `e${year}-${i}`,
    year,
    designation: `Ligne ${i}`,
    category: null,
    hours: null,
    sale_status: "regle",
    ...p,
  } as CaEntry;
}

const options = { period: "exercice_complet" as const };
const today = { year: 2026, month: 2 };
const rows2026 = [
  entry(2026, { month: 1, kind: "vente", amount_ht: 1000, hours: 8, category: "SAP" }, 1),
  entry(2026, { month: 1, kind: "vente", amount_ht: 500, hours: 4 }, 2),
  entry(2026, { month: 1, kind: "charge", amount_ht: 200 }, 3),
  entry(2026, { month: 2, kind: "vente", amount_ht: 750.5, hours: 5 }, 4),
  entry(2026, { month: 2, kind: "charge", amount_ht: 100 }, 5),
  entry(2026, { month: 2, kind: "charge", amount_ht: 999, is_investment: true }, 6),
];
const rows2025 = [entry(2025, { month: 1, kind: "vente", amount_ht: 800 }, 7)];
const rows2024 = [entry(2024, { month: 3, kind: "vente", amount_ht: 300 }, 8)];

describe("classeur Backup PP CA", () => {
  test("un onglet par année, exercice courant en premier", async () => {
    const buf = await buildCaBackupWorkbook({
      years: [
        { year: 2024, entries: rows2024 },
        { year: 2026, entries: rows2026 },
        { year: 2025, entries: rows2025 },
      ],
      options,
      today,
    });
    const zip = await JSZip.loadAsync(buf);
    const wbXml = await zip.file("xl/workbook.xml")!.async("string");
    const names = [...wbXml.matchAll(/<sheet [^>]*?name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(["CA 2026", "CA 2025", "CA 2024"]);
    const styles = await zip.file("xl/styles.xml")!.async("string");
    for (const argb of ["FF0F9DE8", "FF92D050", "FFFFC000"])
      expect(styles.includes(argb)).toBe(true);
    const sheet1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet1.includes("<f>C4-B4</f>")).toBe(true);
    expect(/CA 2025[^!]{0,8}!C4/.test(sheet1)).toBe(true);
  });

  test("totaux du modèle identiques à la page CA", () => {
    const m = buildYearModel(2026, rows2026, options, today);
    const t = yearTotals(rows2026, options);
    expect(m.caTotal).toBeCloseTo(t.ventesHt, 2);
    expect(m.chargesTotal).toBeCloseTo(t.chargesHt, 2);
    expect(m.caTotal).toBeCloseTo(2250.5, 2);
    expect(m.chargesTotal).toBeCloseTo(300, 2);
    expect(m.investmentsTotal).toBeCloseTo(999, 2);
  });
});
