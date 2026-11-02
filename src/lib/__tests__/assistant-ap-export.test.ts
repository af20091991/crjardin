import { describe, expect, it } from "bun:test";
import type { ApSupply } from "@/lib/assistant-ap";
import { buildOrderText, groupSuppliesBySupplier, isOrderable } from "@/lib/assistant-ap-export";
import { isReadyForExport } from "@/lib/assistant-ap-checks";

const supply = (patch: Partial<ApSupply>): ApSupply => ({
  id: "1",
  worksite_id: "w",
  supplier: "Pépinière Martin",
  supplier_id: null,
  quantity: "10",
  item: "Lavande",
  status: "a_faire",
  mode: "livraison",
  fulfillment_date: "2026-10-20",
  comment: null,
  ...patch,
});

describe("export fournitures AP", () => {
  it("regroupe par fournisseur sans tenir compte de la casse", () => {
    const orders = groupSuppliesBySupplier([
      supply({ id: "1" }),
      supply({ id: "2", supplier: "pépinière martin", item: "Romarin" }),
      supply({ id: "3", supplier: "Agri Sud", item: "Terreau" }),
    ]);
    expect(orders.map((o) => o.supplier)).toEqual(["Agri Sud", "Pépinière Martin"]);
    expect(orders[1].lines).toHaveLength(2);
  });

  it("n'exporte par défaut ni le stock ni les articles OK", () => {
    expect(isOrderable(supply({}))).toBe(true);
    expect(isOrderable(supply({ mode: "stock" }))).toBe(false);
    expect(isOrderable(supply({ status: "ok" }))).toBe(false);
  });

  it.each(["a_faire", "commande_reserve", "retrait_livraison_prevu", "a_relancer"] as const)(
    "inclut les fournitures non terminées au statut %s dans les deux exports",
    (status) => {
      const rows = [supply({ supplier: "AEF", supplier_id: "aef", status })];
      expect(isOrderable(rows[0])).toBe(true);
      expect(isReadyForExport(rows, [{ id: "aef", name: "AEF" }])).toBe(true);
      expect(groupSuppliesBySupplier(rows.filter(isOrderable))[0].supplier).toBe("AEF");
    },
  );

  it("conserve les cinq lignes AEF de Lequien avec les autres fournisseurs", () => {
    const rows = [
      ...["Arbre de Judée C30", "Faux poivrier 12/14 35L", "Yucca rostrata C30", "Vivaces"].map(
        (item, i) => supply({ id: `aef-${i}`, supplier: "AEF", item, status: "commande_reserve" }),
      ),
      supply({ id: "aef-4", supplier: "AEF", status: "retrait_livraison_prevu" }),
      supply({ id: "dmd", supplier: "DMD", mode: "retrait" }),
      supply({ id: "stock", supplier: "Stock", mode: "stock", status: "ok" }),
      supply({ id: "ruiz", supplier: "Ruiz", status: "ok" }),
    ];
    const orders = groupSuppliesBySupplier(rows.filter(isOrderable));
    expect(orders.map((order) => order.supplier)).toEqual(["AEF", "DMD"]);
    expect(orders[0].lines).toHaveLength(5);
    expect(orders[1].lines).toHaveLength(1);
  });

  it("ne propose pas de commande si toutes les fournitures sont en stock ou terminées", () => {
    expect(isReadyForExport([supply({ mode: "stock" }), supply({ status: "ok" })], [])).toBe(false);
  });

  it("produit le texte avec livraison oui/non et date souhaitée", () => {
    const text = buildOrderText(
      { scheduled_date: "2026-10-27", date_label: null },
      groupSuppliesBySupplier([
        supply({}),
        supply({ id: "2", item: "Graviers", mode: "retrait", fulfillment_date: null }),
      ]),
    );
    expect(text).toContain("Fournisseur : Pépinière Martin");
    expect(text).toContain("Date prévue du chantier : mardi 27 octobre 2026");
    expect(text).toContain("Lavande — Quantité : 10 — Livraison : oui");
    expect(text).toContain(
      "Graviers — Quantité : 10 — Livraison : non — Date de livraison souhaitée : —",
    );
  });
});
