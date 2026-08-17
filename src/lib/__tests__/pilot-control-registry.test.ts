import { describe, expect, test } from "bun:test";
import {
  buildChainProof,
  buildRegistryReport,
  CONTROL_REGISTRY,
  evaluateControl,
  controlById,
  type ControlObservation,
} from "@/lib/pilot-control-registry";

const anyDef = () => CONTROL_REGISTRY[0];
const obs = (over: Partial<ControlObservation> = {}): ControlObservation => ({
  id: anyDef().id,
  analysed: 10,
  failing: 0,
  ...over,
});

describe("registre exhaustif des contrôles", () => {
  test("chaque contrôle documente sa source, sa validité et sa non-applicabilité", () => {
    expect(CONTROL_REGISTRY.length).toBeGreaterThan(15);
    for (const d of CONTROL_REGISTRY) {
      expect(d.source.length).toBeGreaterThan(0);
      expect(d.field.length).toBeGreaterThan(0);
      expect(d.validity.length).toBeGreaterThan(0);
      expect(d.notApplicable.length).toBeGreaterThan(0);
      expect(d.action.length).toBeGreaterThan(0);
      expect(d.consumers.length).toBeGreaterThan(0);
    }
    const ids = CONTROL_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(controlById("temps.vente.heures")?.family).toBe("temps");
  });

  test("un contrôle sans observation reste indisponible, jamais certifié", () => {
    const r = evaluateControl(anyDef(), null);
    expect(r.status).toBe("indisponible");
    expect(r.cause).toBe("source_indisponible");
  });

  test("une erreur de lecture n'est pas une absence de donnée", () => {
    const r = evaluateControl(anyDef(), obs({ loadError: "timeout" }));
    expect(r.status).toBe("indisponible");
    expect(r.message).toContain("Ce n'est pas une absence");
  });

  test("une mesure inconnue n'est jamais remplacée par 0", () => {
    const r = evaluateControl(anyDef(), obs({ analysed: null, failing: null }));
    expect(r.status).toBe("indisponible");
    expect(r.analysed).toBeNull();
    expect(r.coveragePct).toBeNull();
  });

  test("statuts certifie / partiel / a_confirmer / non_exploitable", () => {
    expect(evaluateControl(anyDef(), obs()).status).toBe("certifie");
    expect(evaluateControl(anyDef(), obs({ failing: 3 })).status).toBe("partiel");
    expect(evaluateControl(anyDef(), obs({ failing: 3, confirmable: true })).status).toBe(
      "a_confirmer",
    );
    expect(evaluateControl(anyDef(), obs({ failing: 1, contradictory: true })).status).toBe(
      "non_exploitable",
    );
    expect(evaluateControl(anyDef(), obs({ notApplicable: true })).status).toBe("non_applicable");
  });

  test("un exercice hors périmètre est non requis et ne bloque aucun KPI", () => {
    const r = evaluateControl(anyDef(), obs({ year: 2025, failing: 40 }));
    expect(r.status).toBe("non_requis");
    expect(r.blocksKpi).toBe(false);
  });

  test("le rapport chiffre l'impact et distingue le non mesurable", () => {
    const report = buildRegistryReport([
      { id: "finance.charges.classement", analysed: 100, failing: 4, amountFailing: 2500 },
      { id: "temps.vente.heures", analysed: 100, failing: 2 },
    ]);
    expect(report.amountAtRisk).toBe(2500);
    expect(report.unquantified).toBe(1);
    // Toutes les autres lignes du registre restent explicitement indisponibles.
    expect(report.counts.indisponible).toBe(CONTROL_REGISTRY.length - 2);
    expect(report.blocking).toBe(true);
    expect(report.families.some((f) => f.family === "finance")).toBe(true);
  });

  test("preuve de bout en bout : chaque maillon est comparé", () => {
    const ok = buildChainProof({
      label: "CA HT",
      steps: [
        { stage: "lignes", value: 120000 },
        { stage: "totaux", value: 120000 },
        { stage: "moteur", value: 120000.005 },
        { stage: "kpi", value: 120000 },
      ],
    });
    expect(ok.certifiable).toBe(true);
    expect(ok.status).toBe("certifie");

    const gap = buildChainProof({
      label: "CA HT",
      steps: [
        { stage: "lignes", value: 120000 },
        { stage: "moteur", value: 118000 },
      ],
    });
    expect(gap.status).toBe("non_exploitable");
    expect(gap.links[0].gap).toBe(-2000);

    const documented = buildChainProof({
      label: "Taux horaire",
      steps: [
        { stage: "lignes", value: 59075 },
        { stage: "moteur", value: 55848 },
      ],
      documentedGap: 3227,
    });
    expect(documented.links[0].cause).toBe("perimetre_documente");
    expect(documented.certifiable).toBe(true);

    const missing = buildChainProof({
      label: "Heures",
      unit: "h",
      steps: [
        { stage: "lignes", value: null },
        { stage: "moteur", value: 500 },
      ],
    });
    expect(missing.status).toBe("indisponible");
    expect(missing.links[0].gap).toBeNull();
  });
});
