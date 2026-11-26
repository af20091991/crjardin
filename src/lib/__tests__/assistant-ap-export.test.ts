import { describe, expect, it } from "bun:test";
import type { ApSupply } from "@/lib/assistant-ap";
import { buildOrderText, groupSuppliesBySupplier, isOrderable } from "@/lib/assistant-ap-export";

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
