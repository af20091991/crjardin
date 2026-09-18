import { describe, expect, it } from "bun:test";
import {
  aggregateSeoPages,
  aggregateSeoQueries,
  seoOpportunities,
  seoStrengths,
  seoSummary,
  seoWeaknesses,
} from "@/lib/site-web-seo-diagnostic";

const row = (
  query: string,
  page: string,
  clicks: number,
  impressions: number,
  position: number,
) => ({
  keys: [query, page],
  clicks,
  impressions,
  ctr: impressions > 0 ? clicks / impressions : 0,
  position,
});

describe("site-web SEO diagnostic", () => {
  it("agrège les données Search Console par requête et par page", () => {
    const rows = [
      row(
        "paysagiste Montpellier",
        "https://www.delagraineaujardin.com/",
        12,
        100,
        4,
      ),
      row(
        "paysagiste Montpellier",
        "https://www.delagraineaujardin.com/conseil",
        8,
        100,
        8,
      ),
      row(
        "jardin mediterraneen Montpellier",
        "https://www.delagraineaujardin.com/jardin-sec",
        2,
        120,
        8,
      ),
      row(
        "entretien jardin Montpellier",
        "https://www.delagraineaujardin.com/entretien",
        1,
        80,
        24,
      ),
    ];

    const queries = aggregateSeoQueries(rows);
    const pages = aggregateSeoPages(rows);
    const query = queries.find(
      (item) => item.query === "paysagiste Montpellier",
    );

    expect(query?.clicks).toBe(20);
    expect(query?.impressions).toBe(200);
    expect(query?.position).toBe(6);
    expect(pages.find((item) => item.page.endsWith("/"))?.clicks).toBe(12);
  });

  it("identifie les forces, opportunités et faiblesses", () => {
    const queries = aggregateSeoQueries([
      row(
        "paysagiste Montpellier",
        "https://www.delagraineaujardin.com/",
        12,
        100,
        4,
      ),
      row(
        "jardin mediterraneen Montpellier",
        "https://www.delagraineaujardin.com/jardin-sec",
        2,
        120,
        8,
      ),
      row(
        "entretien jardin Montpellier",
        "https://www.delagraineaujardin.com/entretien",
        1,
        80,
        24,
      ),
    ]);

    expect(seoStrengths(queries)[0].query).toBe("paysagiste Montpellier");
    expect(seoOpportunities(queries)[0].query).toBe(
      "jardin mediterraneen Montpellier",
    );
    expect(seoWeaknesses(queries)[0].query).toBe(
      "entretien jardin Montpellier",
    );

    const summary = seoSummary(queries);
    expect(summary.totalClicks).toBe(15);
    expect(summary.top10Clicks).toBe(14);
  });
});
