import { describe, expect, it } from "bun:test";
import { buildChantierRows, type RapprochementSale } from "@/lib/rentabilite-chantier";

const C = "client-1";
const sale = (over: Partial<RapprochementSale>): RapprochementSale => ({
  client_id: C,
  year: 2026,
  month: 3,
  kind: "vente",
  amount_ht: 0,
  hours: null,
  ...over,
});

describe("buildChantierRows", () => {
  it("rapproche vente, charge et temps SST pour un client et un mois", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 1000, hours: 10 }),
        sale({ kind: "charge", charge_category: "SST", amount_ht: 300 }),
      ],
      [{ client_id: C, mission_date: "2026-03-05", hours_spent: 4 }],
      2026,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ca_ht: 1000,
      temps_vente: 10,
      charge_ht: 300,
      temps_charge: 4,
      marge_ht: 700,
      taux_horaire: 70,
      statut: "complet",
    });
  });

  it("signale une charge sans temps SST pour rapprochement manuel", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 500, hours: 5 }),
        sale({ kind: "charge", charge_category: "Charge chantier", amount_ht: 100 }),
      ],
      [],
      2026,
    );
    expect(rows[0].statut).toBe("temps_charge_manquant");
    expect(rows[0].temps_charge).toBeNull();
  });

  it("ignore les autres charges et les autres années", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 500, hours: 5 }),
        sale({ kind: "charge", charge_category: "Carburant", amount_ht: 999 }),
        sale({ year: 2025, amount_ht: 800, hours: 8 }),
      ],
      [],
      2026,
    );
    expect(rows[0].charge_ht).toBe(0);
    expect(rows[0].ca_ht).toBe(500);
  });

  it("sans heures de vente, le taux horaire reste vide", () => {
    const rows = buildChantierRows([sale({ amount_ht: 500 })], [], 2026);
    expect(rows[0].taux_horaire).toBeNull();
    expect(rows[0].statut).toBe("temps_vente_manquant");
  });
});
