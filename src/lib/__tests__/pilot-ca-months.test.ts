// Mode « exercice complet » : 12 mois, nature explicite, total = somme exacte.
import { describe, expect, test } from "bun:test";
import { monthlyCaRows, monthlyCaTotals } from "@/lib/pilot-ca-months";
import type { CaEntry } from "@/lib/pilot-ca";

const NOW = new Date("2026-08-16T12:00:00Z");
const YEAR = 2026;

const row = (over: Partial<CaEntry> & { id: string; month: number }): CaEntry =>
  ({
    user_id: "u1",
    year: YEAR,
    kind: "vente",
    designation: null,
    category: null,
    amount_ht: 0,
    hours: 0,
    is_fixed: false,
    position: 0,
    note: null,
    client_id: null,
    sale_status: "regle",
    entry_date: null,
    created_at: "",
    updated_at: "",
    ...over,
  }) as CaEntry;

const entries: CaEntry[] = [
  row({ id: "v1", month: 3, amount_ht: 1_000 }),
  row({ id: "c1", month: 3, kind: "charge", amount_ht: 400 }),
  row({ id: "v2", month: 11, amount_ht: 700, entry_date: `${YEAR}-11-10` }),
  row({ id: "inv", month: 3, kind: "charge", amount_ht: 5_000, is_investment: true }),
];

describe("tableau des 12 mois de l'exercice", () => {
  test("toujours 12 lignes, dans l'ordre des mois", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW, period: "exercice_complet" });
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows[0].monthLabel).toBe("Janvier");
  });

  test("natures : réalisé à date, saisi futur, aucun enregistrement", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW, period: "exercice_complet" });
    expect(rows[2].nature).toBe("realise_a_date");
    expect(rows[10].nature).toBe("saisi_futur");
    expect(rows[0].nature).toBe("aucun");
  });

  test("mois vide : aucune valeur inventée", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW, period: "exercice_complet" });
    expect(rows[0]).toMatchObject({ ventesHt: 0, chargesHt: 0, resultat: 0, rowCount: 0 });
  });

  test("investissements exclus des charges du mois", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW, period: "exercice_complet" });
    expect(rows[2].chargesHt).toBe(400);
    expect(rows[2].resultat).toBe(600);
  });

  test("total annuel = somme exacte des 12 lignes", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW, period: "exercice_complet" });
    const t = monthlyCaTotals(rows);
    expect(t.ventesHt).toBe(1_700);
    expect(t.chargesHt).toBe(400);
    expect(t.resultat).toBe(rows.reduce((s, r) => s + r.resultat, 0));
    expect(t.monthsWithData).toBe(2);
    expect(t.monthsFuture).toBe(1);
  });

  test("en mode « à date » les mois futurs restent vides", () => {
    const rows = monthlyCaRows(entries, YEAR, { now: NOW });
    expect(rows[10].nature).toBe("aucun");
    expect(monthlyCaTotals(rows).ventesHt).toBe(1_000);
  });
});
