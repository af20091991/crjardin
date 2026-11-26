import { describe, expect, it } from "bun:test";
import { sstReconciliation } from "@/lib/sst-accounting-gap";
import type { SubcontractorMission } from "@/lib/subcontractors";

const mission = (
  id: string,
  date: string,
  cost: number,
  extra: Partial<SubcontractorMission> = {},
) =>
  ({
    id,
    user_id: "u",
    subcontractor_id: "s1",
    client_id: "c1",
    mission_date: date,
    invoiced_amount: cost,
    agreed_price: cost,
    archived_at: null,
    prestation: null,
    service_requested: "x",
    ...extra,
  }) as unknown as SubcontractorMission;

const charge = (
  id: string,
  month: number,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  year: 2026,
  month,
  amount_ht: amount,
  designation: "SST Dupont",
  kind: "charge",
  is_investment: false,
  charge_category: "SST",
  subcontractor_mission_id: null,
  match_status: "en_attente",
  ...extra,
});

describe("sstReconciliation", () => {
  it("lie une charge à la mission de même mois et montant", () => {
    const r = sstReconciliation({
      charges: [charge("a", 3, 100)],
      missions: [mission("m1", "2026-03-10", 100)],
    });
    expect(r.unlinkedCharges).toHaveLength(0);
    expect(r.missingMissions).toHaveLength(0);
  });

  it("propose les charges non rattachées et les missions sans charge", () => {
    const r = sstReconciliation({
      charges: [charge("a", 4, 55)],
      missions: [mission("m1", "2026-03-10", 100)],
    });
    expect(r.unlinkedCharges.map((c) => c.id)).toEqual(["a"]);
    expect(r.missingMissions.map((m) => m.id)).toEqual(["m1"]);
  });

  it("retire une charge marquée « sans fiche » et une mission rattachée manuellement", () => {
    const r = sstReconciliation({
      charges: [
        charge("a", 4, 55, { match_status: "sans_fiche" }),
        charge("b", 5, 80, { subcontractor_mission_id: "m2" }),
      ],
      missions: [mission("m1", "2026-03-10", 100), mission("m2", "2026-05-02", 70)],
    });
    expect(r.unlinkedCharges).toHaveLength(0);
    expect(r.missingMissions.map((m) => m.id)).toEqual(["m1"]);
  });

  it("ignore les autres exercices, les missions archivées et les investissements", () => {
    const r = sstReconciliation({
      charges: [charge("a", 4, 55, { is_investment: true })],
      missions: [
        mission("m1", "2025-03-10", 100),
        mission("m2", "2026-03-10", 100, { archived_at: "2026-04-01" }),
      ],
    });
    expect(r.unlinkedCharges).toHaveLength(0);
    expect(r.missingMissions).toHaveLength(0);
  });
});
