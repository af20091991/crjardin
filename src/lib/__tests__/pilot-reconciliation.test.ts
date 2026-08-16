// Réconciliation : aucun écart ne doit être absorbé silencieusement.
import { describe, expect, test } from "bun:test";
import {
  buildReconciliationReport,
  reconcile,
  type ReconciliationInput,
} from "@/lib/pilot-reconciliation";

const COHERENT: ReconciliationInput = {
  salesLinesHt: 120_000,
  engineCaHt: 120_000,
  engineCaByMonthHt: 120_000,
  chargeLinesHt: 70_000,
  engineChargesHt: 70_000,
  engineChargeParts: [40_000, 25_000, 5_000],
  engineBeneficeHt: 50_000,
  engineMargePct: (50_000 / 120_000) * 100,
  ledgerSaleHours: 1_500,
  engineHoursVendues: 1_500,
  engineHoursReelles: 1_500,
  engineTauxHoraireReel: 80,
};

describe("reconcile", () => {
  test("valeurs identiques : conforme", () => {
    const r = reconcile({ id: "x", label: "x", expected: 10, actual: 10 });
    expect(r.kind).toBe("conforme");
    expect(r.status).toBe("certifie");
  });

  test("écart d'arrondi toléré, écart réel non toléré", () => {
    expect(reconcile({ id: "x", label: "x", expected: 10, actual: 10.005 }).kind).toBe("arrondi");
    const gap = reconcile({ id: "x", label: "x", expected: 10, actual: 11 });
    expect(gap.kind).toBe("anomalie");
    expect(gap.status).toBe("suspect");
  });

  test("valeur absente : jamais remplacée par 0", () => {
    const r = reconcile({ id: "x", label: "x", expected: null, actual: 10 });
    expect(r.kind).toBe("donnee_manquante");
    expect(r.status).toBe("incomplet");
    expect(r.expected).toBeNull();
  });

  test("écart de périmètre documenté n'est pas suspect", () => {
    const r = reconcile({
      id: "x",
      label: "x",
      expected: 10,
      actual: 12,
      kindWhenGap: "perimetre_documente",
    });
    expect(r.status).toBe("certifie");
  });
});

describe("buildReconciliationReport", () => {
  test("chaîne cohérente : tout est certifié et non bloquant", () => {
    const report = buildReconciliationReport(COHERENT);
    expect(report.status).toBe("certifie");
    expect(report.blocking).toBe(false);
    expect(report.rows.every((r) => r.status === "certifie")).toBe(true);
  });

  test("bénéfice incohérent avec CA − charges : bloquant", () => {
    const report = buildReconciliationReport({ ...COHERENT, engineBeneficeHt: 55_000 });
    expect(report.status).toBe("suspect");
    expect(report.blocking).toBe(true);
    expect(report.rows.find((r) => r.id === "resultat_vs_ca_charges")!.kind).toBe("calcul");
  });

  test("somme des lignes ≠ CA publié : écart signalé", () => {
    const report = buildReconciliationReport({ ...COHERENT, salesLinesHt: 118_000 });
    const row = report.rows.find((r) => r.id === "ca_lignes_vs_moteur")!;
    expect(row.gap).toBe(2_000);
    expect(row.status).toBe("suspect");
  });

  test("charges par nature ≠ total : écart signalé", () => {
    const report = buildReconciliationReport({
      ...COHERENT,
      engineChargeParts: [40_000, 25_000, 0],
    });
    expect(report.rows.find((r) => r.id === "charges_categories_vs_total")!.status).toBe("suspect");
  });

  test("heures absentes : aucun taux horaire inventé, statut incomplet", () => {
    const report = buildReconciliationReport({
      ...COHERENT,
      engineHoursReelles: 0,
      engineTauxHoraireReel: null,
      ledgerSaleHours: null,
    });
    const taux = report.rows.find((r) => r.id === "taux_horaire_vs_ca_heures")!;
    expect(taux.kind).toBe("donnee_manquante");
    expect(report.status).not.toBe("certifie");
  });

  test("SST : écart classé comme rattachement, non bloquant", () => {
    const report = buildReconciliationReport({
      ...COHERENT,
      sstMissionCost: 8_000,
      sstChargeCost: 9_500,
    });
    const sst = report.rows.find((r) => r.id === "sst_missions_vs_charges")!;
    expect(sst.kind).toBe("rattachement");
    expect(sst.status).toBe("incomplet");
    expect(report.blocking).toBe(false);
  });
});