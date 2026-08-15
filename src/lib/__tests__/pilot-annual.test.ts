import { describe, expect, test } from "bun:test";
import { annualSummary } from "@/lib/pilot-annual";
import { charge, sale, YEAR } from "./pilot-fixtures";

describe("annualSummary", () => {
  test("aucune donnée : aucun exercice inventé", () => {
    expect(annualSummary([], [])).toEqual([]);
  });

  test("exercice sans charge : marge non présentée comme fiable", () => {
    const [row] = annualSummary(
      [sale({ id: "s1", entry_date: `${YEAR}-04-15`, amount_ht: 1_000, hours: 10 })],
      [],
    );
    expect(row.caHt).toBe(1_000);
    expect(row.charges).toBe(0);
    expect(row.chargesComplete).toBe(false);
    expect(row.margePct).toBeNull();
  });

  test("charge enregistrée à 0 € : exercice toujours jugé incomplet (marge non calculée)", () => {
    // Règle en place : `chargesComplete` exige un montant de charges > 0.
    // Une ligne de charge à 0 € ne suffit donc pas à rendre la marge fiable.
    const [row] = annualSummary(
      [sale({ id: "s1", entry_date: `${YEAR}-04-15`, amount_ht: 1_000, hours: 10 })],
      [charge({ id: "c0", year: YEAR, month: 4, amount_ht: 0 })],
    );
    expect(row.charges).toBe(0);
    expect(row.chargesComplete).toBe(false);
    expect(row.margePct).toBeNull();
  });

  test("investissements exclus du bénéfice brut et suivis séparément", () => {
    const [row] = annualSummary(
      [sale({ id: "s1", entry_date: `${YEAR}-04-15`, amount_ht: 10_000, hours: 100 })],
      [
        charge({ id: "c1", year: YEAR, month: 4, amount_ht: 4_000 }),
        charge({ id: "inv", year: YEAR, month: 5, amount_ht: 3_000, is_investment: true }),
      ],
    );
    expect(row.charges).toBe(4_000);
    expect(row.beneficeBrut).toBe(6_000);
    expect(row.investissements).toBe(3_000);
    expect(row.resultatApresInvestissements).toBe(3_000);
    expect(row.margePct).toBe(60);
  });

  test("taux horaire vendu : seules les lignes porteuses de temps sont retenues", () => {
    const [row] = annualSummary(
      [
        sale({ id: "s1", entry_date: `${YEAR}-04-15`, amount_ht: 1_000, hours: 10 }),
        sale({ id: "s2", entry_date: `${YEAR}-04-15`, amount_ht: 5_000, hours: 0 }),
      ],
      [charge({ id: "c1", year: YEAR, month: 4, amount_ht: 100 })],
    );
    expect(row.caHt).toBe(6_000);
    expect(row.heuresVendues).toBe(10);
    expect(row.tauxHoraireVendu).toBe(100);
    expect(row.nbLignes).toBe(2);
  });

  test("un exercice par année réellement présente, du plus récent au plus ancien", () => {
    const rows = annualSummary(
      [
        sale({ id: "a", entry_date: `${YEAR - 2}-04-15`, amount_ht: 100 }),
        sale({ id: "b", entry_date: `${YEAR}-04-15`, amount_ht: 200 }),
      ],
      [],
    );
    expect(rows.map((r) => r.year)).toEqual([YEAR, YEAR - 2]);
  });
});
