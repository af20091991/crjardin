import { describe, expect, it } from "bun:test";
import { historicalReference, median, goalHealth } from "@/lib/pilot-health-dashboard";
import type { AnnualRow } from "@/lib/pilot-annual";
import type { Goal } from "@/lib/pilot-goals";

const annual = (year: number, caHt: number, chargesComplete = true): AnnualRow =>
  ({
    year,
    caHt,
    charges: chargesComplete ? 100 : 0,
    beneficeBrut: caHt - (chargesComplete ? 100 : 0),
    margePct: chargesComplete ? ((caHt - 100) / caHt) * 100 : null,
    heuresVendues: 0,
    tauxHoraireVendu: null,
    nbLignes: 10,
    investissements: 0,
    resultatApresInvestissements: caHt - (chargesComplete ? 100 : 0),
    chargesComplete,
  }) as AnnualRow;

const goal = (id: string, status: Goal["status"], priority: Goal["priority"], deadline: string | null): Goal =>
  ({
    id,
    user_id: "u",
    theme: "commercial",
    title: id,
    deadline,
    priority,
    status,
    completed_date: null,
    comment: null,
    position: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  }) as Goal;

describe("pilot-health-dashboard", () => {
  it("calculates the median without inventing a target", () => {
    expect(median([100, 300, 200])).toBe(200);
    expect(median([100, 300])).toBe(200);
    expect(median([])).toBeNull();
  });

  it("uses only complete historical exercises for the personal reference", () => {
    const ref = historicalReference(
      [annual(2023, 100), annual(2024, 300), annual(2025, 900, false)],
      (row) => row.caHt,
    );
    expect(ref.value).toBe(200);
    expect(ref.years).toEqual([2023, 2024]);
  });

  it("reads manual goals without changing their statuses", () => {
    const health = goalHealth(
      [
        goal("done", "termine", "haute", "2026-08-01"),
        goal("late", "en_cours", "haute", "2026-08-01"),
        goal("current", "en_cours", "moyenne", "2026-12-01"),
        goal("abandoned", "abandonne", "basse", "2026-01-01"),
      ],
      "2026-09-17",
    );
    expect(health.active).toHaveLength(3);
    expect(health.done).toHaveLength(1);
    expect(health.late).toHaveLength(1);
    expect(health.completionRate).toBeCloseTo(100 / 3 * 100);
  });
});
