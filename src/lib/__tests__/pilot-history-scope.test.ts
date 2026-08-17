import { describe, expect, it } from "bun:test";
import {
  CERTIFICATION_START_YEAR,
  HISTORY_OUT_OF_SCOPE_MESSAGE,
  historyScopeForYear,
  historyScopeForYears,
  isOutOfCertificationScope,
  splitByCertificationScope,
} from "@/lib/pilot-history-scope";
import { buildKpiReliability } from "@/lib/pilot-kpi-reliability";
import { KPI_CONTRACTS } from "@/lib/pilot-kpi-contract";

const baseInput = {
  contracts: KPI_CONTRACTS,
  snapshot: null,
  dataStatus: "ready" as const,
  dataMessage: "",
  qualityStatus: "ready" as const,
  qualityMessage: "",
};

describe("périmètre de certification (< 2026 non requis)", () => {
  it("qualifie l'historique antérieur à 2026 comme hors périmètre", () => {
    expect(isOutOfCertificationScope(2025)).toBe(true);
    expect(isOutOfCertificationScope(CERTIFICATION_START_YEAR)).toBe(false);
    expect(historyScopeForYear(2024)).toBe("hors_perimetre");
    expect(historyScopeForYear(2026)).toBe("certifiable");
    expect(historyScopeForYears([2024, 2026])).toBe("mixte");
    expect(historyScopeForYears([2023, 2025])).toBe("hors_perimetre");
    expect(historyScopeForYears([2026, 2027])).toBe("certifiable");
  });

  it("sépare l'historique sans supprimer ni modifier aucune ligne", () => {
    const rows = [
      { year: 2024, ht: 1000 },
      { year: 2026, ht: 2000 },
      { year: 2027, ht: 3000 },
    ];
    const { historical, certifiable } = splitByCertificationScope(rows);
    expect(historical).toEqual([{ year: 2024, ht: 1000 }]);
    expect(certifiable.map((r) => r.ht)).toEqual([2000, 3000]);
    expect(historical.length + certifiable.length).toBe(rows.length);
  });

  it("affiche le message unique et ne bloque pas un KPI 2026", () => {
    expect(HISTORY_OUT_OF_SCOPE_MESSAGE).toContain("hors périmètre de certification");
    const past = buildKpiReliability({ ...baseInput, year: 2025 });
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((r) => r.readiness === "non_requis")).toBe(true);
    expect(past.every((r) => r.explanation === HISTORY_OUT_OF_SCOPE_MESSAGE)).toBe(true);

    const current = buildKpiReliability({ ...baseInput, year: 2026 });
    expect(current.some((r) => r.readiness === "non_requis")).toBe(false);
  });
});
