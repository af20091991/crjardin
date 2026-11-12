import { describe, expect, it } from "bun:test";
import { buildChantierRows, type RapprochementSale } from "@/lib/rentabilite-chantier";

const C = "client-1";
let n = 0;
const sale = (over: Partial<RapprochementSale>): RapprochementSale => ({
  id: `e${++n}`,
  client_id: C,
  year: 2026,
  month: 3,
  kind: "vente",
  amount_ht: 0,
  hours: null,
  ...over,
});

describe("buildChantierRows", () => {
  it("rapproche vente et charge SST pour un client et un mois", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 1000, hours: 10, category: "AP", designation: "Taille haies" }),
        sale({ kind: "charge", charge_category: "SST", amount_ht: 300 }),
      ],
      2026,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ca_ht: 1000,
      temps_vente: 10,
      charge_ht: 300,
      marge_ht: 700,
      taux_horaire: 70,
      statut: "complet",
    });
    expect(rows[0].prestations).toEqual([{ category: "AP", designation: "Taille haies" }]);
  });

  it("collecte les commentaires des lignes vente et charge", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 500, hours: 5, note: "Chantier décalé" }),
        sale({
          kind: "charge",
          charge_category: "Charge chantier",
          amount_ht: 100,
          note: "Location nacelle",
        }),
      ],
      2026,
    );
    expect(rows[0].notes.map((x) => x.source)).toEqual(["vente", "charge"]);
  });

  it("ignore les autres charges et les autres années", () => {
    const rows = buildChantierRows(
      [
        sale({ amount_ht: 500, hours: 5 }),
        sale({ kind: "charge", charge_category: "Carburant", amount_ht: 999 }),
        sale({ year: 2025, amount_ht: 800, hours: 8 }),
      ],
      2026,
    );
    expect(rows[0].charge_ht).toBe(0);
    expect(rows[0].ca_ht).toBe(500);
  });

  it("sans heures de vente, le taux horaire reste vide et le statut le signale", () => {
    const rows = buildChantierRows([sale({ amount_ht: 500 })], 2026);
    expect(rows[0].taux_horaire).toBeNull();
    expect(rows[0].statut).toBe("temps_vente_manquant");
  });
});
