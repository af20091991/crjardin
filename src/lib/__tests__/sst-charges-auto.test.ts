import { describe, expect, it } from "bun:test";
import { hasSstPrefix, linkChargesToMissions, shouldAutoClassifySst } from "@/lib/sst-charges";
import type { SubcontractorMission } from "@/lib/subcontractors";

const mission = (id: string, date: string, cost: number, archived = false) =>
  ({
    id,
    mission_date: date,
    invoiced_amount: cost,
    agreed_price: null,
    archived_at: archived ? "2026-01-01" : null,
  }) as unknown as SubcontractorMission;

describe("préfixe SST", () => {
  it("reconnaît « SST » en début de libellé uniquement", () => {
    expect(hasSstPrefix("SST Dupont")).toBe(true);
    expect(hasSstPrefix("  sst - Martin 03/2026")).toBe(true);
    expect(hasSstPrefix("SST")).toBe(true);
    expect(hasSstPrefix("Facture SST Dupont")).toBe(false);
    expect(hasSstPrefix("SSTAR carburant")).toBe(false);
    expect(hasSstPrefix(null)).toBe(false);
  });

  it("ne remplace jamais un classement explicite", () => {
    const base = { designation: "SST Dupont" };
    expect(shouldAutoClassifySst({ ...base, charge_category: null })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "À classer" })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "Charge variable" })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "SST" })).toBe(false);
    expect(shouldAutoClassifySst({ ...base, charge_category: "Charge fixe" })).toBe(false);
    expect(shouldAutoClassifySst({ ...base, is_investment: true })).toBe(false);
    expect(shouldAutoClassifySst({ designation: "Carburant", charge_category: null })).toBe(false);
  });
});

describe("rapprochement charges SST / missions", () => {
  it("rattache une charge à la mission de même mois et même montant", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 450 }],
      [mission("m1", "2026-03-12", 450)],
    );
    expect(links.get("c1")).toEqual({ missionId: "m1", duplicate: false });
  });

  it("signale un doublon quand deux charges identiques n'ont qu'une mission", () => {
    const links = linkChargesToMissions(
      [
        { id: "c1", year: 2026, month: 3, amount: 450 },
        { id: "c2", year: 2026, month: 3, amount: 450 },
      ],
      [mission("m1", "2026-03-12", 450)],
    );
    expect(links.get("c1")?.missionId).toBe("m1");
    expect(links.get("c2")).toEqual({ missionId: null, duplicate: true });
  });

  it("ignore les missions archivées et les montants différents", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 450 }],
      [mission("m1", "2026-03-12", 450, true), mission("m2", "2026-03-12", 300)],
    );
    expect(links.get("c1")).toEqual({ missionId: null, duplicate: false });
  });
});
