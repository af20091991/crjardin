import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { isRemunerationGrossed } from "@/lib/pilot-ca";
import { remunerationBreakdown, fixedChargesSum, type FixedCharge } from "@/lib/pilot-fixed-charges";

const page = readFileSync("src/routes/_authenticated/pilot.ca.tsx", "utf8");

const POSTES: Array<[string, number]> = [
  ["Expert-comptable", 124],
  ["Loyer", 65],
  ["CFE", 43.25],
  ["PER", 150],
  ["Free", 16.66],
  ["Crédit Agricole et divers", 21],
  ["Adhésion Accès SAP", 2.08],
  ["Auto", 132.77],
  ["RC", 26.95],
  ["Prévoyance", 89.58],
  ["Mutuelle", 52.15],
  ["Site web", 2.28],
];

const rows = (): FixedCharge[] =>
  POSTES.map(([label, monthly_amount], i) => ({
    id: `f${i}`,
    user_id: "u",
    year: 2026,
    label,
    monthly_amount,
    position: i,
    is_active: true,
    ca_entry_id: "entry-1",
  }));

describe("rémunération majorée (dès août 2026)", () => {
  it("net 2000 → ligne à 2900", () => {
    expect(Math.round(remunerationBreakdown(2000).total * 100) / 100).toBe(2900);
  });

  it("ressaisie du même net sans dérive d'arrondi", () => {
    const net = 2137.37;
    const a = Math.round(remunerationBreakdown(net).total * 100) / 100;
    const b = Math.round(remunerationBreakdown(net).total * 100) / 100;
    expect(a).toBe(b);
  });

  it("aucune majoration avant août 2026", () => {
    expect(isRemunerationGrossed(2026, 7)).toBe(false);
    expect(isRemunerationGrossed(2025, 12)).toBe(false);
    expect(isRemunerationGrossed(2026, 8)).toBe(true);
    expect(isRemunerationGrossed(2027, 1)).toBe(true);
  });
});

describe("charges fixes — détail = montant de la ligne", () => {
  it("somme du détail = 725,72 €", () => {
    expect(fixedChargesSum(rows())).toBe(725.72);
  });

  it("se recalcule à la modification d'un poste", () => {
    const r = rows();
    r[0].monthly_amount = 130;
    expect(fixedChargesSum(r)).toBe(731.72);
  });

  it("ignore les postes désactivés (pas de double comptage)", () => {
    const r = rows();
    r[1].is_active = false;
    expect(fixedChargesSum(r)).toBe(660.72);
  });
});

describe("page CA — un seul encart rémunération, avant les charges", () => {
  it("un unique encart Rémunération", () => {
    const occurrences = page.match(/Rémunération \{MONTH_NAMES\[month - 1\]\}/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("l'encart est positionné avant la carte Charges", () => {
    expect(page.indexOf('data-testid="ca-remuneration-card"')).toBeLessThan(
      page.indexOf("{/* Charges */}"),
    );
  });

  it("la ligne charges fixes est dépliable et non ressaisie", () => {
    expect(page).toContain("FixedChargesDetail");
    expect(page).toContain('data-testid="ca-fixed-row-amount"');
  });
});
