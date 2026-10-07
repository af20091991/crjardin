import { describe, expect, it } from "bun:test";
import { salesByCategory, salesByStatus, variationPct } from "@/lib/pilot-dashboard-views";
import type { CaEntry } from "@/lib/pilot-ca";

const sale = (month: number, amount: number, status: string, category: string | null): CaEntry =>
  ({
    kind: "vente",
    month,
    amount_ht: amount,
    sale_status: status,
    category,
  }) as unknown as CaEntry;

describe("dashboard — vues année / mois", () => {
  it("variationPct renvoie null sans base de comparaison", () => {
    expect(variationPct(100, 0)).toBeNull();
    expect(variationPct(150, 100)).toBeCloseTo(50, 6);
    expect(variationPct(50, 100)).toBeCloseTo(-50, 6);
  });

  it("salesByStatus sépare réglé, réalisé et planifié par mois", () => {
    const rows = salesByStatus(
      [sale(10, 100, "regle", "AP"), sale(10, 40, "planifie", "AP"), sale(11, 70, "realise", null)],
      [
        { month: 10, label: "Oct" },
        { month: 11, label: "Nov" },
      ],
    );
    expect(rows[0]).toEqual({ label: "Oct", Réglé: 100, Réalisé: 0, Planifié: 40, Particulier: 0 });
    expect(rows[1]?.Réalisé).toBe(70);
  });

  it("salesByCategory regroupe, garde « Autre » pour ce qui ne se classe pas et trie", () => {
    const rows = salesByCategory([
      sale(10, 100, "regle", "AP"),
      sale(10, 300, "planifie", null),
      sale(11, 50, "regle", "AP"),
    ]);
    expect(rows).toEqual([
      { name: "Autre", value: 300 },
      { name: "AP", value: 150 },
    ]);
    expect(
      salesByCategory([sale(10, 100, "regle", "AP"), sale(11, 5, "regle", "SAP")], 11),
    ).toEqual([{ name: "SAP", value: 5 }]);
  });
});
