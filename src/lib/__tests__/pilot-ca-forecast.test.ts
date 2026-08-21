// Carte « Prévisionnel total HT — ventes du mois » : tous statuts, périmètre du mode.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { monthForecastHt } from "@/lib/pilot-ca-forecast";
import { monthTotals, type CaEntry } from "@/lib/pilot-ca";

const NOW = new Date("2026-08-21T10:00:00Z");
const YEAR = 2026;

const sale = (over: Partial<CaEntry>): CaEntry =>
  ({
    id: crypto.randomUUID(),
    user_id: "u",
    year: YEAR,
    month: 8,
    kind: "vente",
    designation: "Chantier",
    category: "AP",
    amount_ht: 1_000,
    hours: 10,
    is_fixed: false,
    position: 0,
    note: null,
    client_id: null,
    sale_status: "planifie",
    created_at: "",
    updated_at: "",
    ...over,
  }) as CaEntry;

describe("prévisionnel total HT des ventes du mois", () => {
  const rows = [
    sale({ month: 8, amount_ht: 1_000, sale_status: "planifie" }),
    sale({ month: 8, amount_ht: 500, sale_status: "regle" }),
    sale({ month: 8, kind: "charge", amount_ht: 300 } as Partial<CaEntry>),
    sale({ month: 9, amount_ht: 700, sale_status: "planifie" }),
  ];

  test("cumul du mois, tous statuts, charges exclues", () => {
    expect(monthForecastHt(rows, 8, { period: "a_date", now: NOW })).toBe(1_500);
  });

  test("« À date » exclut les mois futurs", () => {
    expect(monthForecastHt(rows, 9, { period: "a_date", now: NOW })).toBe(0);
  });

  test("« Année complète » inclut les ventes futures saisies", () => {
    expect(monthForecastHt(rows, 9, { period: "exercice_complet", now: NOW })).toBe(700);
  });

  test("non-régression : le CA HT du mois garde sa règle de statut", () => {
    expect(monthTotals(rows, 8, { period: "a_date", now: NOW }).ventesHt).toBe(500);
  });

  test("la carte CA TTC n'existe plus sur la page CA", () => {
    const src = readFileSync("src/routes/_authenticated/pilot.ca.tsx", "utf8");
    expect(src).not.toContain('label="CA TTC"');
    expect(src).toContain("Prévisionnel total HT — ventes du mois");
  });
});
