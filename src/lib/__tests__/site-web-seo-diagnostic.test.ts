import { describe, expect, it } from "bun:test";
import {
  aggregateSeoPages,
  aggregateSeoQueries,
  compareSeoQueries,
  seoOpportunities,
  seoPageOpportunities,
  significantChanges,
} from "@/lib/site-web-seo-diagnostic";

describe("site-web — diagnostic SEO", () => {
  const rows = [
    { keys: ["jardin méditerranéen", "https://example.test/a"], clicks: 20, impressions: 500, ctr: 0.04, position: 7 },
    { keys: ["paysagiste montpellier", "https://example.test/b"], clicks: 2, impressions: 100, ctr: 0.02, position: 12 },
  ];

  it("agrège les requêtes et les pages sans inventer de métriques", () => {
    expect(aggregateSeoQueries(rows)).toHaveLength(2);
    expect(aggregateSeoPages(rows)).toHaveLength(2);
    expect(aggregateSeoQueries(rows)[0]?.impressions).toBe(500);
  });

  it("détecte séparément les opportunités de requête et de page", () => {
    expect(seoOpportunities(aggregateSeoQueries(rows)).map((item) => item.query)).toContain(
      "paysagiste montpellier",
    );
    expect(seoPageOpportunities(aggregateSeoPages(rows)).map((item) => item.page)).toContain(
      "https://example.test/b",
    );
  });

  it("compare les clics avec la période précédente", () => {
    const previous = [
      { keys: ["paysagiste montpellier", "https://example.test/b"], clicks: 10, impressions: 100, ctr: 0.1, position: 9 },
    ];
    const changes = compareSeoQueries(rows, previous);
    expect(changes.find((item) => item.key === "paysagiste montpellier")?.change).toBeCloseTo(-0.8);
    expect(significantChanges(changes)[0]?.key).toBe("paysagiste montpellier");
  });
});
