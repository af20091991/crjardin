import { describe, expect, test, mock } from "bun:test";

// Le pont analytique (bridgeCaEntries → listEntries) doit appliquer la même
// règle unique de comptabilisation que la page Chiffre d'affaires.
mock.module("@/lib/pilot-ca-fetch", () => ({
  CA_PAGE_SIZE: 1000,
  fetchAllCaRows: async (_columns: string, filters: { kind?: string } = {}) => {
    if (filters.kind !== "vente") return [];
    return [
      {
        id: "s1",
        user_id: "u",
        year: 2026,
        month: 9,
        kind: "vente",
        designation: "Chantier futur",
        category: "AP",
        amount_ht: 1_000,
        hours: 10,
        client_id: null,
        sale_status: "planifie",
        intervention_type: "interne",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: "s2",
        user_id: "u",
        year: 2026,
        month: 9,
        kind: "vente",
        designation: "Chantier facturé",
        category: "AP",
        amount_ht: 500,
        hours: 5,
        client_id: null,
        sale_status: "realise",
        intervention_type: "interne",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ];
  },
}));

const { listEntries } = await import("@/lib/pilot");

describe("moteur analytique — CA saisi en exercice complet", () => {
  test("planifié et facturé comptés en exercice complet", async () => {
    const rows = await listEntries({ period: "exercice_complet" });
    expect(rows.reduce((s, r) => s + r.amount_ht, 0)).toBe(1_500);
  });

  test("non-régression à date : aucun CA planifié/facturé", async () => {
    const rows = await listEntries({ period: "a_date" });
    expect(rows.reduce((s, r) => s + r.amount_ht, 0)).toBe(0);
    // Le montant brut reste lisible pour l'affichage.
    expect(rows.reduce((s, r) => s + (r.amount_ht_raw ?? 0), 0)).toBe(1_500);
  });
});
