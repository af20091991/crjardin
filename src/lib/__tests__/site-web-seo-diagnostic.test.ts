import { describe, expect, it } from "vitest";
import {
  aggregateSeoPages,
  aggregateSeoQueries,
  seoOpportunities,
  seoStrengths,
  seoWeaknesses,
  seoSummary,
} from "@/lib/site-web-seo-diagnostic";

describe("site-web SEO diagnostic", () => {
  const rows = [
    {
      keys: ["paysagiste Montpellier", "https://www.delagraineaujardin.com/"],
      clicks: 12,
      impressions: 100,
      ctr: 0.12,
      position: 4,
    },
    {
      keys: [
        "paysagiste Montpellier",
        "https://www.delagraineaujardin.com/conseil",
      ],
      clicks: 8,
      impressions: 100,
      ctr: 0.08,
      position: 8,
    },
    {
      keys: [
        "jardin mediterraneen Montpellier",
        "https://www.delagraineaujardin.com/jardin-sec",
      ],
      clicks: 2,
      impressions: 120,
      ctr: 0.016,
      position: 12,
    },
    {
      keys: [
        "entretien jardin Montpellier",
        "https://www.delagraineaujardin.com/entretien",
      ],
      clicks: 1,
      impressions: 80,
      ctr: 0.0125,
      position: 24,
    },
  ];

  it("agrège les lignes Search Console par requête", () => {
    const result = aggregateSeoQueries(rows);
    const item = result.find(
      (entry) => entry.query === "paysagiste Montpellier",
    );
    expect(item?.clicks).toBe(20);
    expect(item?.impressions).toBe(200);
    expect(item?.position).toBe(6);
  });

  it("agrège les lignes Search Console par page", () => {
    const result = aggregateSeoPages(rows);
    expect(result.find((entry) => entry.page.endsWith("/"))?.clicks).toBe(12);
    expect(
      result.find((entry) => entry.page.endsWith("/jardin-sec"))?.impressions,
    ).toBe(120);
  });

  it("identifie forces, opportunités et faiblesses sans score global", () => {
    const queries = aggregateSeoQueries(rows);
    expect(seoStrengths(queries)[0].query).toBe("paysagiste Montpellier");
    expect(seoOpportunities(queries)[0].query).toBe(
      "jardin mediterraneen Montpellier",
    );
    expect(seoWeaknesses(queries)[0].query).toBe(
      "entretien jardin Montpellier",
    );
  });

  it("calcule la part des clics depuis le top 10", () => {
    const summary = seoSummary(aggregateSeoQueries(rows));
    expect(summary.totalClicks).toBe(23);
    expect(summary.top10Clicks).toBe(20);
    expect(summary.top10ClickShare).toBeCloseTo(20 / 23);
  });
});
