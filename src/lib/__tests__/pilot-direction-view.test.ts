// Protection de la page Direction : uniquement de l'assemblage d'affichage.
// Aucune formule métier n'est testée ici (elles le sont dans les moteurs).
import { describe, expect, test } from "bun:test";
import { buildAnalytics, type AnalyticsSnapshot } from "@/lib/pilot-engine";
import { KPI_CONTRACTS } from "@/lib/pilot-kpi-contract";
import { buildKpiReliability, type KpiReadiness } from "@/lib/pilot-kpi-reliability";
import type { KpiKey } from "@/lib/pilot-engine";
import { flexCompatibility, resolveFlexType } from "@/lib/pilot-flex-chart";
import {
  DIRECTION_MAX_ALERTS,
  DIRECTION_MAX_DECISIONS,
  DIRECTION_MAX_KPIS,
  buildDirectionAlerts,
  buildDirectionDatasets,
  buildDirectionDecisions,
  buildDirectionKpis,
  periodLabel,
} from "@/lib/pilot-direction-view";
import { engineInputs, NOW, YEAR, scope } from "./pilot-fixtures";

const snapshot: AnalyticsSnapshot = buildAnalytics(engineInputs(), NOW);

function readinessMap(snap: AnalyticsSnapshot | null, dataStatus: "success" | "error" = "success") {
  const rows = buildKpiReliability({
    contracts: KPI_CONTRACTS,
    snapshot: snap,
    dataStatus,
    dataMessage: "socle.",
    qualityStatus: "success",
    qualityMessage: "qualité.",
  });
  const map: Partial<Record<KpiKey, { readiness: KpiReadiness; explanation: string }>> = {};
  for (const r of rows)
    map[r.contract.id as KpiKey] = { readiness: r.readiness, explanation: r.explanation };
  return map;
}

const kpis = buildDirectionKpis({
  snapshot,
  readiness: readinessMap(snapshot),
  periodLabel: periodLabel("a_date", YEAR, NOW),
});

describe("KPI de la page Direction", () => {
  test("au plus 6 KPI principaux", () => {
    expect(kpis.length).toBeLessThan(DIRECTION_MAX_KPIS + 1);
    expect(kpis.length).toBeGreaterThan(0);
  });

  test("aucun KPI sans valeur n'est présenté comme certifié", () => {
    for (const k of kpis) {
      if (k.display === "—" || k.display === "En attente de certification") {
        expect(k.readiness).not.toBe("certifie");
        expect(k.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  test("une lecture en erreur retire toute certification", () => {
    const degraded = buildDirectionKpis({
      snapshot,
      readiness: readinessMap(snapshot, "error"),
      periodLabel: periodLabel("a_date", YEAR, NOW),
    });
    expect(degraded.filter((k) => k.readiness === "certifie")).toHaveLength(0);
  });

  test("les valeurs affichées viennent du moteur, sans recalcul", () => {
    const ca = kpis.find((k) => k.key === "ca_annuel");
    expect(ca).toBeDefined();
    if (snapshot.kpis.ca_annuel.value != null) {
      expect(ca!.display).toContain(String(Math.round(snapshot.kpis.ca_annuel.value)).slice(0, 2));
    }
  });

  test("aucun snapshot : aucun KPI affiché", () => {
    expect(buildDirectionKpis({ snapshot: null, readiness: {}, periodLabel: "—" })).toHaveLength(0);
  });
});

describe("Période affichée", () => {
  test("mode à date : la période mentionne la date de référence, pas l'exercice complet", () => {
    const l = periodLabel("a_date", YEAR, NOW);
    expect(l).toContain("Réalisé au");
    expect(l).not.toContain("complet");
  });

  test("exercice complet uniquement sur sélection explicite", () => {
    expect(periodLabel("exercice_complet", YEAR, NOW)).toBe(`Exercice ${YEAR} complet`);
  });

  test("le mode à date n'expose aucun mois futur dans les séries", () => {
    const ds = buildDirectionDatasets(snapshot, "note");
    const mensuel = ds.find((d) => d.id === "ca");
    expect(mensuel).toBeDefined();
    const finance = snapshot.monthly.finance;
    const futureLabels = finance
      .filter((_, i) => i > NOW.getMonth())
      .filter((f) => f.CA !== 0)
      .map((f) => f.mois);
    for (const row of mensuel!.rows) {
      expect(futureLabels).not.toContain(row.name as string);
    }
  });
});

describe("Alertes et décisions", () => {
  test("au plus 3 alertes", () => {
    const a = buildDirectionAlerts({
      snapshot,
      integrityDegraded: true,
      integrityMessage: "sources incomplètes",
    });
    expect(a.length).toBeLessThan(DIRECTION_MAX_ALERTS + 1);
    expect(a[0].text).toContain("sources incomplètes");
  });

  test("au plus 3 décisions et aucune sans snapshot", () => {
    expect(buildDirectionDecisions(snapshot).length).toBeLessThan(DIRECTION_MAX_DECISIONS + 1);
    expect(buildDirectionDecisions(null)).toHaveLength(0);
  });
});

describe("Graphiques de la page Direction", () => {
  const datasets = buildDirectionDatasets(snapshot, "Réalisé arrêté à la date du jour.");

  test("plusieurs indicateurs sélectionnables, tous documentés", () => {
    expect(datasets.length).toBeGreaterThan(6 - 1);
    for (const d of datasets) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.note.length).toBeGreaterThan(0);
      expect(["euro", "heure", "pourcent", "nombre"]).toContain(d.unit);
    }
  });

  test("changer d'indicateur change réellement les séries affichées", () => {
    const ca = datasets.find((d) => d.id === "ca")!;
    const heures = datasets.find((d) => d.id === "heures")!;
    expect(ca.series[0].key).not.toBe(heures.series[0].key);
    expect(ca.unit).not.toBe(heures.unit);
  });

  test("un type incompatible est bloqué puis replié sur un type honnête", () => {
    const multi = datasets.find((d) => d.id === "ca-charges")!;
    const compat = flexCompatibility(multi, "donut");
    expect(compat.ok).toBe(false);
    expect(resolveFlexType(multi, "donut")).not.toBe("donut");
  });

  test("objectif vs réalisé absent quand aucune cible n'existe", () => {
    const noTarget = buildAnalytics(
      engineInputs({
        settings: { ...engineInputs().settings, target_hourly_rate: 0 },
        scope: scope(),
      }),
      NOW,
    );
    expect(buildDirectionDatasets(noTarget, "note").some((d) => d.id === "objectif")).toBe(false);
  });

  test("état vide : aucune ligne inventée", () => {
    expect(buildDirectionDatasets(null, "note")).toHaveLength(0);
  });
});
