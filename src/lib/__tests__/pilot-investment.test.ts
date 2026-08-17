// Saisie manuelle d'un investissement de l'exercice : validation stricte,
// écriture conforme au schéma existant et non-contamination des charges
// d'exploitation (aucune seconde formule d'investissement).
import { describe, expect, test } from "bun:test";
import {
  INVESTMENT_CATEGORY,
  analyzeCharges,
  chargesTotalForYear,
  investmentEntryPayload,
  investmentsByYear,
  investmentsForYear,
  operatingCharges,
  operatingChargesForYear,
  projectionBase,
  validateInvestment,
  type ChargeRow,
} from "@/lib/pilot-charges";
import { reasonsForLine } from "@/lib/pilot-validation";

const NOW = new Date("2026-08-16T12:00:00Z");
const YEAR = 2026;

function rowFromDraft(
  draft: Parameters<typeof validateInvestment>[0],
  id = "inv-1",
): ChargeRow {
  const checked = validateInvestment(draft);
  if (!checked.ok) throw new Error(checked.error);
  const p = investmentEntryPayload(checked.value);
  return {
    id,
    year: p.year,
    month: p.month,
    designation: p.designation,
    amount_ht: p.amount_ht,
    charge_class: p.charge_class,
    charge_category: p.charge_category,
    kind: "charge",
    is_investment: true,
  };
}

const baseCharge: ChargeRow = {
  id: "c-1",
  year: YEAR,
  month: 3,
  designation: "Carburant",
  amount_ht: 1_000,
  charge_class: "variable",
  charge_category: "Carburant",
  kind: "charge",
  is_investment: false,
};

describe("investissement — validation de la saisie", () => {
  test("1. création valide dans l'exercice courant", () => {
    const checked = validateInvestment({
      designation: "  Tondeuse autoportée ",
      amountHt: "12 000,50",
      year: YEAR,
      month: 4,
      note: " achat comptant ",
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.value).toEqual({
      designation: "Tondeuse autoportée",
      amount_ht: 12000.5,
      year: YEAR,
      month: 4,
      note: "achat comptant",
    });
    const payload = investmentEntryPayload(checked.value);
    expect(payload.kind).toBe("charge");
    expect(payload.is_investment).toBe(true);
    expect(payload.charge_category).toBe(INVESTMENT_CATEGORY);
    expect(payload.validation_status).toBe("valide");
    expect(payload.match_status).toBe("non_applicable");
  });

  test("2. désignation vide refusée", () => {
    const r = validateInvestment({ designation: "   ", amountHt: 100, year: YEAR, month: 1 });
    expect(r.ok).toBe(false);
  });

  test("3. montant nul, négatif ou invalide refusé", () => {
    for (const amountHt of [0, -5, "", "abc"]) {
      expect(validateInvestment({ designation: "X", amountHt, year: YEAR, month: 1 }).ok).toBe(false);
    }
  });

  test("4. mois hors intervalle refusé", () => {
    for (const month of [0, 13, 1.5, "" as unknown as number]) {
      expect(validateInvestment({ designation: "X", amountHt: 10, year: YEAR, month }).ok).toBe(false);
    }
  });

  test("5. année du sélecteur global utilisée telle quelle", () => {
    const r = validateInvestment({ designation: "X", amountHt: 10, year: "2025", month: "7" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ year: 2025, month: 7 });
    expect(validateInvestment({ designation: "X", amountHt: 10, year: 1900, month: 1 }).ok).toBe(false);
  });
});

describe("investissement — intégration aux calculs existants", () => {
  const inv = rowFromDraft({ designation: "Tondeuse", amountHt: 5_000, year: YEAR, month: 3 });
  const rows = [baseCharge, inv];
  const sales = new Map([[YEAR, 40_000]]);

  test("6. visible dans le détail de l'exercice", () => {
    expect(rows.filter((r) => r.year === YEAR && r.is_investment)).toHaveLength(1);
  });

  test("7. inclus dans le total des investissements", () => {
    expect(investmentsForYear(rows, YEAR, { now: NOW })).toBe(5_000);
    expect(investmentsByYear(rows).get(YEAR)).toBe(5_000);
    expect(analyzeCharges(rows, sales, [], { now: NOW }).investmentsTotal).toBe(5_000);
  });

  test("8. inclus dans le résultat après investissements", () => {
    const base = projectionBase(rows, YEAR, sales, { now: NOW });
    expect(base.investments).toBe(5_000);
    expect(base.margeDisponible).toBe(40_000 - 1_000);
    expect(base.resultatApresInvestissements).toBe(40_000 - 1_000 - 5_000);
  });

  test("9. exclu des charges d'exploitation et du bénéfice brut", () => {
    expect(chargesTotalForYear(rows, YEAR, { now: NOW })).toBe(1_000);
    expect(operatingChargesForYear(rows, YEAR, { now: NOW }).map((r) => r.id)).toEqual(["c-1"]);
    const analysis = analyzeCharges(rows, sales, [], { now: NOW });
    expect(analysis.totals.total).toBe(1_000);
    expect(analysis.totals.fixe + analysis.totals.variable).toBe(1_000);
  });

  test("10. jamais compté deux fois", () => {
    const analysis = analyzeCharges(rows, sales, [], { now: NOW });
    expect(analysis.investmentsTotal + analysis.totals.total).toBe(6_000);
    expect(operatingCharges(rows).filter((r) => r.is_investment)).toHaveLength(1); // hors exercice filtré
    expect(analysis.remuneration.lines).toBe(0);
  });

  test("11. investissement futur exclu du réalisé à date", () => {
    const future = rowFromDraft({ designation: "Camion", amountHt: 20_000, year: YEAR, month: 12 }, "inv-2");
    expect(investmentsForYear([...rows, future], YEAR, { now: NOW })).toBe(5_000);
    expect(projectionBase([...rows, future], YEAR, sales, { now: NOW }).investments).toBe(5_000);
  });

  test("12. inclus en mode Exercice complet / Projection", () => {
    const future = rowFromDraft({ designation: "Camion", amountHt: 20_000, year: YEAR, month: 12 }, "inv-2");
    expect(
      investmentsForYear([...rows, future], YEAR, { now: NOW, period: "exercice_complet" }),
    ).toBe(25_000);
    expect(investmentsForYear([...rows, future], YEAR, { now: NOW, mode: "projection" })).toBe(25_000);
  });

  test("16. statut explicite : ni charge à classer, ni rémunération", () => {
    expect(
      reasonsForLine({
        kind: "charge",
        designation: inv.designation,
        charge_class: inv.charge_class,
        charge_category: inv.charge_category,
        match_status: "non_applicable",
        is_investment: true,
      }),
    ).toEqual([]);
  });
});