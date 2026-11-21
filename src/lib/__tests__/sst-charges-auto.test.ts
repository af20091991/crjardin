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
  it("reconnaît « SST » comme mot, où qu'il soit dans le libellé", () => {
    expect(hasSstPrefix("SST Dupont")).toBe(true);
    expect(hasSstPrefix("  sst - Martin 03/2026")).toBe(true);
    expect(hasSstPrefix("SST")).toBe(true);
    expect(hasSstPrefix("Facture SST Dupont")).toBe(true);
    expect(hasSstPrefix("Dupont-SST 03/2026")).toBe(true);
    expect(hasSstPrefix("SSTAR carburant")).toBe(false);
    expect(hasSstPrefix(null)).toBe(false);
  });

  it("la mention SST fait foi, sauf charge fixe, rémunération ou investissement", () => {
    const base = { designation: "SST Dupont" };
    expect(shouldAutoClassifySst({ ...base, charge_category: null })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "À classer" })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "Charge chantier" })).toBe(true);
    expect(shouldAutoClassifySst({ ...base, charge_category: "SST" })).toBe(false);
    expect(shouldAutoClassifySst({ ...base, charge_category: "Charge fixe" })).toBe(false);
    expect(shouldAutoClassifySst({ ...base, charge_category: "Rémunération" })).toBe(false);
    expect(shouldAutoClassifySst({ ...base, is_investment: true })).toBe(false);
    expect(shouldAutoClassifySst({ designation: "Carburant", charge_category: null })).toBe(false);
    expect(shouldAutoClassifySst({ designation: "Sous-traitance Lozza" })).toBe(true);
    expect(shouldAutoClassifySst({ designation: "Ss-traitance d'Aboville" })).toBe(true);
  });
});

describe("rapprochement charges SST / missions", () => {
  it("rattache une charge à la mission du même mois, même si le montant diffère", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 450 }],
      [mission("m1", "2026-03-12", 300)],
    );
    expect(links.get("c1")).toEqual({ missionId: "m1", duplicate: false });
  });

  it("une mission n'accueille qu'une charge, la seconde reste comptée sans mission", () => {
    const links = linkChargesToMissions(
      [
        { id: "c1", year: 2026, month: 3, amount: 450 },
        { id: "c2", year: 2026, month: 3, amount: 450 },
      ],
      [mission("m1", "2026-03-12", 450)],
    );
    expect(links.get("c1")?.missionId).toBe("m1");
    expect(links.get("c2")).toEqual({ missionId: null, duplicate: false });
  });

  it("ignore les missions archivées et les autres mois", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 450 }],
      [mission("m1", "2026-03-12", 450, true), mission("m2", "2026-04-02", 450)],
    );
    expect(links.get("c1")).toEqual({ missionId: null, duplicate: false });
  });

  it("le rattachement manuel prime sur la correspondance automatique", () => {
    const links = linkChargesToMissions(
      [
        { id: "c1", year: 2026, month: 3, amount: 450, manualMissionId: "m2" },
        { id: "c2", year: 2026, month: 3, amount: 300 },
      ],
      [mission("m1", "2026-03-12", 300), mission("m2", "2026-03-20", 80)],
    );
    expect(links.get("c1")?.missionId).toBe("m2");
    expect(links.get("c2")?.missionId).toBe("m1");
  });
});

describe("sous-traitance accompagnée", () => {
  it("une mission accompagnée n'accueille jamais de charge (coût = charge de chantier)", () => {
    const accompanied = {
      ...mission("m1", "2026-03-12", 300),
      sst_mode: "accompagnee",
    } as unknown as SubcontractorMission;
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 300 }],
      [accompanied],
    );
    expect(links.get("c1")).toEqual({ missionId: null, duplicate: false });
  });
});

describe("qualification de la charge SST", () => {
  it("une charge « chantier » (accompagnée) ne se rattache jamais à une mission", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 300, sstMode: "accompagnee" }],
      [mission("m1", "2026-03-12", 300)],
    );
    expect(links.get("c1")).toEqual({ missionId: null, duplicate: false });
  });

  it("une charge autonome se rattache à la mission du même mois", () => {
    const links = linkChargesToMissions(
      [{ id: "c1", year: 2026, month: 3, amount: 300, sstMode: "autonome" }],
      [mission("m1", "2026-03-12", 300)],
    );
    expect(links.get("c1")?.missionId).toBe("m1");
  });
});
