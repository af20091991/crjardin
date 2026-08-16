import { describe, expect, it } from "bun:test";
import { buildSstReconciliation, missionRef } from "@/lib/sst-reconciliation";
import { isSubcontractingLabel } from "@/lib/sst-charges";
import type { SstChargeLine } from "@/lib/sst-charges";

const charge = (o: Partial<SstChargeLine> & { id: string; month: number; amount: number }): SstChargeLine => ({
  year: 2026,
  designation: "Sous-traitance",
  provider: "",
  clientName: null,
  duplicateOfMission: false,
  ...o,
});

const m = (o: { id: string; date: string; amount: number; sst: string; client?: string }) =>
  missionRef({
    id: o.id,
    mission_date: o.date,
    invoiced_amount: o.amount,
    agreed_price: null,
    service_requested: "Taille",
    sstName: o.sst,
    clientName: o.client ?? null,
  });

describe("rapprochement SST", () => {
  const period = "exercice_complet" as const;

  it("rapproche mois + montant identiques", () => {
    const r = buildSstReconciliation({
      missions: [m({ id: "m1", date: "2026-03-10", amount: 300, sst: "Chloé" })],
      chargeLines: [charge({ id: "c1", month: 3, amount: 300, designation: "Sous-traitance Chloé" })],
      year: 2026,
      period,
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.kind).toBe("correspondance_exacte");
    expect(r.status).toBe("certifie");
    expect(r.gap).toBe(0);
  });

  it("classe une charge sans mission et une mission sans charge", () => {
    const r = buildSstReconciliation({
      missions: [m({ id: "m1", date: "2026-03-10", amount: 300, sst: "Chloé" })],
      chargeLines: [charge({ id: "c1", month: 5, amount: 120, designation: "Sous-traitance Lozza" })],
      year: 2026,
      period,
    });
    const kinds = r.rows.map((x) => x.kind).sort();
    expect(kinds).toEqual(["charge_sans_mission", "mission_sans_charge"]);
    expect(r.unmatchedMissionTotal).toBe(300);
    expect(r.unmatchedChargeTotal).toBe(120);
    expect(r.gap).toBe(180);
    expect(r.status).toBe("incomplet");
  });

  it("détecte un décalage de période sur montant identique", () => {
    const r = buildSstReconciliation({
      missions: [m({ id: "m1", date: "2026-06-10", amount: 250, sst: "Fanny" })],
      chargeLines: [charge({ id: "c1", month: 2, amount: 250, designation: "Sous-traitance Fanny" })],
      year: 2026,
      period,
    });
    expect(r.rows[0]!.kind).toBe("difference_periode");
  });

  it("signale un doublon strict côté charges", () => {
    const r = buildSstReconciliation({
      missions: [],
      chargeLines: [
        charge({ id: "c1", month: 4, amount: 100, designation: "Sous-traitance X" }),
        charge({ id: "c2", month: 4, amount: 100, designation: "Sous-traitance X" }),
      ],
      year: 2026,
      period,
    });
    expect(r.rows.filter((x) => x.kind === "doublon")).toHaveLength(1);
    expect(r.status).toBe("suspect");
  });

  it("chaque ligne est comptée une seule fois", () => {
    const r = buildSstReconciliation({
      missions: [
        m({ id: "m1", date: "2026-03-10", amount: 300, sst: "Chloé" }),
        m({ id: "m2", date: "2026-03-12", amount: 300, sst: "Chloé" }),
      ],
      chargeLines: [charge({ id: "c1", month: 3, amount: 300, designation: "Sous-traitance Chloé" })],
      year: 2026,
      period,
    });
    expect(r.matchedMissionTotal + r.unmatchedMissionTotal).toBe(r.missionTotal);
    expect(r.matchedChargeTotal + r.unmatchedChargeTotal).toBe(r.chargeTotal);
  });

  it("filtre les deux côtés sur le même exercice", () => {
    const r = buildSstReconciliation({
      missions: [m({ id: "m1", date: "2025-03-10", amount: 300, sst: "Chloé" })],
      chargeLines: [charge({ id: "c1", year: 2025, month: 3, amount: 300 })],
      year: 2026,
      period,
    });
    expect(r.rows).toHaveLength(0);
    expect(r.missionTotal).toBe(0);
    expect(r.chargeTotal).toBe(0);
  });

  it("détecte la variante « Ss-traitance » dans les libellés", () => {
    expect(isSubcontractingLabel("Ss-traitance d'Aboville")).toBe(true);
    expect(isSubcontractingLabel("Carburant")).toBe(false);
  });
});
