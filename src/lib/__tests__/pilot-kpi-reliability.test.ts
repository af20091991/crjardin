// Protection de la LECTURE de fiabilité des KPI. Aucune formule métier n'est
// testée ici : uniquement la traduction état + contrat → aptitude d'usage.
import { describe, expect, test } from "bun:test";
import { buildAnalytics, type AnalyticsSnapshot } from "@/lib/pilot-engine";
import { KPI_CONTRACTS } from "@/lib/pilot-kpi-contract";
import {
  MONTHS_OBSERVED_LABEL,
  buildKpiReliability,
} from "@/lib/pilot-kpi-reliability";
import { engineInputs, NOW } from "./pilot-fixtures";

const snapshot: AnalyticsSnapshot = buildAnalytics(engineInputs(), NOW);

const ok = {
  contracts: KPI_CONTRACTS,
  snapshot,
  dataStatus: "success" as const,
  dataMessage: "socle disponible.",
  qualityStatus: "success" as const,
  qualityMessage: "rapport disponible.",
};

const row = (rows: ReturnType<typeof buildKpiReliability>, id: string) => {
  const found = rows.find((r) => r.contract.id === id);
  if (!found) throw new Error(`contrat ${id} absent`);
  return found;
};

describe("buildKpiReliability", () => {
  test("couvre exactement les indicateurs du contrat", () => {
    expect(buildKpiReliability(ok)).toHaveLength(KPI_CONTRACTS.length);
  });

  test("un KPI non produit par le moteur n'est jamais présenté comme certifié", () => {
    const rows = buildKpiReliability(ok);
    const marge = row(rows, "marge");
    expect(marge.readiness).not.toBe("certifie");
    expect(marge.explanation.length).toBeGreaterThan(0);
  });

  test("une erreur de chargement rend tous les KPI non disponibles", () => {
    const rows = buildKpiReliability({
      ...ok,
      dataStatus: "error",
      dataMessage: "lecture impossible.",
    });
    // qualite_globale dépend du rapport qualité, pas du socle analytique.
    expect(
      rows.filter((r) => r.contract.id !== "qualite_globale").every((r) => r.readiness === "non_disponible"),
    ).toBe(true);
  });

  test("données périmées : fiabilité partielle, jamais certifiée", () => {
    const rows = buildKpiReliability({ ...ok, dataStatus: "stale", dataMessage: "périmé." });
    expect(
      rows.filter((r) => r.readiness === "certifie" && r.contract.id !== "qualite_globale"),
    ).toHaveLength(0);
    expect(row(rows, "ca_annuel").readiness).toBe("partiel");
  });

  test("socle vide : KPI non exploitables", () => {
    const rows = buildKpiReliability({ ...ok, dataStatus: "empty", dataMessage: "aucune donnée." });
    expect(row(rows, "ca_annuel").readiness).toBe("non_exploitable");
  });

  test("chargement en cours : aucun statut définitif", () => {
    const rows = buildKpiReliability({ ...ok, dataStatus: "loading", dataMessage: "chargement." });
    expect(row(rows, "ca_annuel").readiness).toBe("non_disponible");
  });

  test("erreur du rapport qualité : seul qualite_globale est dégradé", () => {
    const rows = buildKpiReliability({
      ...ok,
      qualityStatus: "error",
      qualityMessage: "lecture impossible.",
    });
    expect(row(rows, "qualite_globale").readiness).toBe("non_disponible");
    expect(row(rows, "ca_annuel").readiness).toBe("certifie");
  });

  test("projection_annuelle distingue réalisé, projection et mois écoulés", () => {
    const p = row(buildKpiReliability(ok), "projection_annuelle");
    expect(p.details.some((d) => d.startsWith("Réalisé à date"))).toBe(true);
    expect(p.details.some((d) => d.startsWith("Projection"))).toBe(true);
    expect(p.details.some((d) => d.startsWith(MONTHS_OBSERVED_LABEL))).toBe(true);
  });

  test("monthsObserved est libellé en mois calendaires écoulés", () => {
    expect(MONTHS_OBSERVED_LABEL).toBe(
      "Mois calendaires écoulés jusqu'à la date de référence",
    );
  });
});
