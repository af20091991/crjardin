import { describe, expect, it } from "bun:test";
import { aggregateSeoQueries, seoActions, seoSummary } from "@/lib/site-web-seo-diagnostic";

describe("site-web SEO diagnostic", () => {
  it("agrège les lignes Search Console par requête", () => {
    const queries = aggregateSeoQueries([
      {
        keys: ["paysagiste Montpellier", "/"],
        clicks: 4,
        impressions: 100,
        ctr: 0.04,
        position: 6,
      },
      {
        keys: ["paysagiste Montpellier", "/contact"],
        clicks: 2,
        impressions: 50,
        ctr: 0.04,
        position: 10,
      },
    ]);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({
      query: "paysagiste Montpellier",
      clicks: 6,
      impressions: 150,
    });
    expect(queries[0].position).toBeCloseTo(7.33, 1);
  });

  it("calcule la part des clics issus du top 10", () => {
    const queries = aggregateSeoQueries([
      {
        keys: ["jardin méditerranéen"],
        clicks: 8,
        impressions: 100,
        position: 5,
      },
      {
        keys: ["entretien jardin"],
        clicks: 2,
        impressions: 100,
        position: 14,
      },
    ]);

    expect(seoSummary(queries).top10ClickShare).toBeCloseTo(0.8);
  });

  it("produit une action locale exploitable sans inventer de donnée", () => {
    const queries = aggregateSeoQueries([
      {
        keys: ["paysagiste Montpellier"],
        clicks: 3,
        impressions: 80,
        position: 7,
        ctr: 0.0375,
      },
      {
        keys: ["plomberie Montpellier"],
        clicks: 0,
        impressions: 3,
        position: 60,
        ctr: 0,
      },
    ]);

    const actions = seoActions(queries);
    expect(actions[0]?.type).toBe("local");
    expect(actions[0]?.query).toBe("paysagiste Montpellier");
    expect(actions[0]?.target).toContain("Google Business Profile");
  });
});
