import { describe, expect, test } from "bun:test";
import { revenueCounted } from "@/lib/pilot-sale-accounting";
import { monthTotals, categoryTotals, type CaEntry } from "@/lib/pilot-ca";

// Référence temporelle figée : août, septembre est donc un mois FUTUR.
const NOW = new Date("2026-08-21T10:00:00Z");

function sale(partial: Partial<CaEntry>): CaEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "u",
    year: 2026,
    month: 9,
    kind: "vente",
    designation: "Chantier",
    category: "AP",
    amount_ht: 1_000,
    hours: 10,
    is_fixed: false,
    position: 0,
    note: null,
    client_id: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...partial,
  } as CaEntry;
}

describe("Exercice complet : tous les statuts de vente comptent (option b)", () => {
  test("règle unique revenueCounted", () => {
    for (const s of ["planifie", "realise", "regle", "particulier"]) {
      expect(revenueCounted(s, { period: "exercice_complet" })).toBe(true);
    }
    // Non-régression « à date » : seuls regle/particulier.
    expect(revenueCounted("planifie")).toBe(false);
    expect(revenueCounted("realise")).toBe(false);
    expect(revenueCounted("planifie", { period: "a_date" })).toBe(false);
    expect(revenueCounted("realise", { period: "a_date" })).toBe(false);
    expect(revenueCounted("regle", { period: "a_date" })).toBe(true);
  });

  test("vente planifiée en septembre : comptée en exercice complet, nulle à date", () => {
    const rows = [sale({ sale_status: "planifie" })];
    expect(monthTotals(rows, 9, { period: "exercice_complet", now: NOW }).ventesHt).toBe(1_000);
    expect(monthTotals(rows, 9, { period: "a_date", now: NOW }).ventesHt).toBe(0);
  });

  test("vente facturée future : comptée en exercice complet, exclue à date", () => {
    const rows = [sale({ sale_status: "realise" })];
    expect(monthTotals(rows, 9, { period: "exercice_complet", now: NOW }).ventesHt).toBe(1_000);
    expect(monthTotals(rows, 9, { period: "a_date", now: NOW }).ventesHt).toBe(0);
  });

  test("categoryTotals suit le même périmètre", () => {
    const rows = [sale({ sale_status: "planifie" })];
    const full = categoryTotals(rows, 9, { period: "exercice_complet", now: NOW });
    expect(full.find((c) => c.category === "AP")?.ht).toBe(1_000);
    const asOf = categoryTotals(rows, 9, { period: "a_date", now: NOW });
    expect(asOf.find((c) => c.category === "AP")?.ht ?? 0).toBe(0);
  });
});
