// Vérification du branchement unique de la page CA sur le period global.
// Un seul clic sur le sélecteur d'en-tête doit piloter à la fois la navigation
// (12 mois vs. mois limités) et les montants affichés.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { monthlyCaRows, monthlyCaTotals } from "@/lib/pilot-ca-months";
import { monthTotals, yearTotals, type CaEntry } from "@/lib/pilot-ca";

const NOW = new Date("2026-08-21T10:00:00Z");
const YEAR = 2026;

function sale(partial: Partial<CaEntry> = {}): CaEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "u",
    year: YEAR,
    month: 9,
    kind: "vente",
    designation: "Chantier futur",
    category: "AP",
    amount_ht: 1_000,
    hours: 10,
    is_fixed: false,
    position: 0,
    note: null,
    client_id: null,
    sale_status: "planifie",
    intervention_type: "interne",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...partial,
  } as CaEntry;
}

describe("page CA — période globale unique", () => {
  test("source unique : aucun état local displayMode dans pilot.ca.tsx", () => {
    const src = readFileSync("src/routes/_authenticated/pilot.ca.tsx", "utf8");
    expect(src).not.toContain("displayMode");
    expect(src).not.toContain('setDisplayMode');
    expect(src).not.toContain('value="annee"');
  });

  test("« Année complète » active 12 mois de navigation ET comptabilise septembre", () => {
    const rows = [sale()];
    const months = monthlyCaRows(rows, YEAR, { now: NOW, period: "exercice_complet" });
    expect(months).toHaveLength(12);
    expect(months[8].ventesHt).toBe(1_000);
    expect(months[8].nature).toBe("saisi_futur");
    const t = monthlyCaTotals(months);
    expect(t.ventesHt).toBe(1_000);
  });

  test("« À date » limite la navigation au mois en cours ET exclut septembre", () => {
    const rows = [sale()];
    const months = monthlyCaRows(rows, YEAR, { now: NOW, period: "a_date" });
    expect(months[8].ventesHt).toBe(0);
    expect(months[8].nature).toBe("aucun");
    const t = monthlyCaTotals(months);
    expect(t.ventesHt).toBe(0);
  });

  test("les montants mensuels et annuels suivent le même period", () => {
    const rows = [sale()];
    const mtFull = monthTotals(rows, 9, { now: NOW, period: "exercice_complet" });
    const ytFull = yearTotals(rows, { now: NOW, period: "exercice_complet" });
    expect(mtFull.ventesHt).toBe(1_000);
    expect(ytFull.ventesHt).toBe(1_000);

    const mtAsOf = monthTotals(rows, 9, { now: NOW, period: "a_date" });
    const ytAsOf = yearTotals(rows, { now: NOW, period: "a_date" });
    expect(mtAsOf.ventesHt).toBe(0);
    expect(ytAsOf.ventesHt).toBe(0);
  });
});
