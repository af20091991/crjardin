// Cohérence CA / interventions / heures : mêmes lignes, même périmètre.
import { describe, expect, it } from "bun:test";
import {
  isBilledSaleLine,
  saleInterventionScopeWhere,
} from "@/lib/pilot-intervention-count";

const rows = [
  { id: "1", kind: "vente", entry_date: "2026-09-02", hours: 8, sale_status: "regle" },
  { id: "2", kind: "vente", entry_date: "2026-09-05", hours: 0, sale_status: "realise" },
  { id: "3", kind: "vente", entry_date: "2026-09-20", hours: 6, sale_status: "planifie" },
  { id: "4", kind: "charge", entry_date: "2026-09-06", hours: 4, sale_status: "regle" },
];

const septembre = (d: Date) => d.getFullYear() === 2026 && d.getMonth() === 8;

describe("périmètre unique des interventions", () => {
  it("ne compte que les lignes de vente comptabilisées", () => {
    expect(isBilledSaleLine(rows[0])).toBe(true);
    expect(isBilledSaleLine(rows[2])).toBe(false);
    expect(isBilledSaleLine(rows[3])).toBe(false);
  });

  it("interventions et heures viennent des mêmes lignes", () => {
    const scope = saleInterventionScopeWhere(rows, septembre);
    expect(scope.interventions).toBe(2);
    expect(scope.hours).toBe(8);
    expect(scope.interventionsWithHours).toBe(1);
  });

  it("ne compte jamais deux fois la même ligne", () => {
    const scope = saleInterventionScopeWhere([...rows, rows[0]], septembre);
    expect(scope.interventions).toBe(2);
    expect(scope.hours).toBe(8);
  });
});
