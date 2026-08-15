// Règle transversale : par défaut TOUT CA annuel est lu « à date » (arrêt au
// jour de consultation). L'exercice complet n'est lu que sur choix explicite.
import { describe, expect, test } from "bun:test";
import { annualSummary } from "@/lib/pilot-annual";
import { entriesForMode, keepRealizedYearMonth, periodScopeLabel } from "@/lib/pilot-realized";
import { monthTotals, yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { NOW, sale, YEAR } from "./pilot-fixtures";

const past = sale({ id: "p", entry_date: `${YEAR}-03-10`, amount_ht: 1000, hours: 10 });
const futureSameMonth = sale({ id: "f1", entry_date: `${YEAR}-08-28`, amount_ht: 500, hours: 5 });
const futureMonth = sale({ id: "f2", entry_date: `${YEAR}-12-31`, amount_ht: 700, hours: 7 });
const all = [past, futureSameMonth, futureMonth];

const caRow = (id: string, month: number, date: string, amount: number): CaEntry =>
  ({
    id,
    user_id: "u1",
    year: YEAR,
    month,
    kind: "vente",
    designation: null,
    category: null,
    amount_ht: amount,
    hours: 1,
    is_fixed: false,
    position: 0,
    note: null,
    client_id: null,
    sale_status: "regle",
    entry_date: date,
    created_at: "",
    updated_at: "",
  }) as CaEntry;

describe("périmètre temporel par défaut « à date »", () => {
  test("exclut les saisies futures du mois en cours et les mois futurs", () => {
    const kept = entriesForMode(all, "reel", NOW);
    expect(kept.map((e) => e.id)).toEqual(["p"]);
  });

  test("l'exercice complet n'est appliqué que sur choix explicite", () => {
    const kept = entriesForMode(all, "reel", NOW, "exercice_complet");
    expect(kept).toHaveLength(3);
  });

  test("annualSummary borne le CA au jour de référence", () => {
    const aDate = annualSummary(all, [], { mode: "reel", now: NOW }).find((r) => r.year === YEAR);
    const complet = annualSummary(all, [], {
      mode: "reel",
      now: NOW,
      period: "exercice_complet",
    }).find((r) => r.year === YEAR);
    expect(aDate?.caHt).toBe(1000);
    expect(complet?.caHt).toBe(2200);
  });

  test("keepRealizedYearMonth borne au jour près", () => {
    expect(keepRealizedYearMonth({ year: YEAR, month: 8, entry_date: `${YEAR}-08-28` }, { now: NOW })).toBe(false);
    expect(keepRealizedYearMonth({ year: YEAR, month: 8, entry_date: `${YEAR}-08-15` }, { now: NOW })).toBe(true);
  });
});

describe("feuille Ventes (pilot-ca)", () => {
  const rows = [
    caRow("a", 3, `${YEAR}-03-10`, 1000),
    caRow("b", 8, `${YEAR}-08-28`, 500),
    caRow("c", 12, `${YEAR}-12-31`, 700),
  ];

  test("yearTotals s'arrête à la date de référence par défaut", () => {
    expect(yearTotals(rows, { now: NOW }).ventesHt).toBe(1000);
  });

  test("yearTotals lit tout l'exercice sur demande explicite", () => {
    expect(yearTotals(rows, { now: NOW, period: "exercice_complet" }).ventesHt).toBe(2200);
  });

  test("monthTotals exclut une vente future du mois en cours", () => {
    expect(monthTotals(rows, 8, { now: NOW }).ventesHt).toBe(0);
  });

  test("libellé du périmètre explicite", () => {
    expect(periodScopeLabel(YEAR, "exercice_complet", NOW)).toContain("complet");
    expect(periodScopeLabel(YEAR, "a_date", NOW)).toContain("à date");
  });
});
