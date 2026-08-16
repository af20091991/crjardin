// Contrôles d'intégrité : une erreur ne doit jamais devenir un 0 fiable.
import { describe, expect, test } from "bun:test";
import {
  buildIntegrityReport,
  checkArithmetic,
  checkAttachment,
  checkDuplicates,
  checkMonthCoverage,
  checkNoFutureDates,
  integrityFromDataStatus,
  worstIntegrity,
} from "@/lib/pilot-integrity";
import type { DataState, DataStatus } from "@/lib/pilot-data-state";

const NOW = new Date("2026-06-15T10:00:00Z");

function state(status: DataStatus): DataState {
  return {
    id: "x",
    label: "Ressource",
    status,
    message: `Ressource : ${status}`,
    updatedAt: status === "loading" ? null : NOW,
    freshness: "actualisé à 10:00",
    unreliable: status === "loading" || status === "error",
    retry: () => {},
  };
}

describe("états de fiabilité", () => {
  test("erreur et chargement ne sont jamais certifiés", () => {
    expect(integrityFromDataStatus("error")).toBe("indisponible");
    expect(integrityFromDataStatus("loading")).toBe("indisponible");
    expect(integrityFromDataStatus("empty")).toBe("incomplet");
    expect(integrityFromDataStatus("success")).toBe("certifie");
  });

  test("le pire état l'emporte", () => {
    expect(worstIntegrity(["certifie", "incomplet", "suspect"])).toBe("suspect");
    expect(worstIntegrity(["certifie", "indisponible"])).toBe("indisponible");
    expect(worstIntegrity(["certifie"])).toBe("certifie");
  });
});

describe("cohérence temporelle", () => {
  test("à date : une ligne future rend la source suspecte", () => {
    const c = checkNoFutureDates([{ date: "2026-12-01" }], "a_date", NOW);
    expect(c.status).toBe("suspect");
  });

  test("à date : aucune ligne future = certifié", () => {
    expect(checkNoFutureDates([{ date: "2026-05-01" }], "a_date", NOW).status).toBe("certifie");
  });

  test("exercice complet explicite : la borne du jour ne s'applique pas", () => {
    expect(checkNoFutureDates([{ date: "2026-12-01" }], "exercice_complet", NOW).status).toBe(
      "certifie",
    );
  });

  test("complétude : seuls les mois écoulés sont attendus à date", () => {
    expect(checkMonthCoverage([1, 2, 3, 4, 5, 6], 2026, "a_date", NOW).status).toBe("certifie");
    expect(checkMonthCoverage([1, 2, 3, 4, 5, 6], 2026, "exercice_complet", NOW).status).toBe(
      "incomplet",
    );
  });
});

describe("doublons, rattachement, arithmétique", () => {
  test("doublon strict détecté", () => {
    expect(checkDuplicates(["a", "b", "a"]).status).toBe("suspect");
    expect(checkDuplicates(["a", "b"]).status).toBe("certifie");
  });

  test("rattachement : 10 % d'orphelins ou plus = suspect", () => {
    expect(checkAttachment(10, 0, "vente").status).toBe("certifie");
    expect(checkAttachment(100, 5, "vente").status).toBe("incomplet");
    expect(checkAttachment(10, 2, "vente").status).toBe("suspect");
  });

  test("arithmétique : tolérance limitée aux arrondis", () => {
    expect(checkArithmetic("CA", 100, [60, 40]).status).toBe("certifie");
    expect(checkArithmetic("CA", 100, [60, 39]).status).toBe("suspect");
  });
});

describe("rapport global", () => {
  test("une source en erreur rend le rapport bloquant", () => {
    const report = buildIntegrityReport({
      year: 2026,
      period: "a_date",
      now: NOW,
      entries: { state: state("error"), rows: undefined },
      charges: { state: state("success"), rows: [] },
    });
    expect(report.status).toBe("indisponible");
    expect(report.blocking).toBe(true);
  });

  test("le périmètre contrôlé est explicite", () => {
    const report = buildIntegrityReport({
      year: 2026,
      period: "a_date",
      now: NOW,
      entries: { state: state("success"), rows: [] },
      charges: { state: state("success"), rows: [] },
    });
    expect(report.periode).toContain("2026");
    expect(report.datasets.length).toBeGreaterThan(0);
  });
});