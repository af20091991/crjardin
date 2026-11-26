export type SeoQueryRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type SeoQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoPage = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const numberValue = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function aggregateSeoQueries(rows: SeoQueryRow[]): SeoQuery[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  rows.forEach((row) => {
    const query = (row.keys?.[0] ?? "").trim();
    if (!query) return;
    const clicks = numberValue(row.clicks);
    const impressions = numberValue(row.impressions);
    const position = numberValue(row.position);
    const current = map.get(query) ?? { clicks: 0, impressions: 0, positionWeighted: 0 };
    current.clicks += clicks;
    current.impressions += impressions;
    current.positionWeighted += position * impressions;
    map.set(query, current);
  });

  return [...map.entries()].map(([query, value]) => ({
    query,
    clicks: value.clicks,
    impressions: value.impressions,
    ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
    position: value.impressions > 0 ? value.positionWeighted / value.impressions : 0,
  }));
}

export function aggregateSeoPages(rows: SeoQueryRow[]): SeoPage[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  rows.forEach((row) => {
    const page = (row.keys?.[1] ?? "").trim();
    if (!page) return;
    const clicks = numberValue(row.clicks);
    const impressions = numberValue(row.impressions);
    const position = numberValue(row.position);
    const current = map.get(page) ?? { clicks: 0, impressions: 0, positionWeighted: 0 };
    current.clicks += clicks;
    current.impressions += impressions;
    current.positionWeighted += position * impressions;
    map.set(page, current);
  });

  return [...map.entries()].map(([page, value]) => ({
    page,
    clicks: value.clicks,
    impressions: value.impressions,
    ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
    position: value.impressions > 0 ? value.positionWeighted / value.impressions : 0,
  }));
}

export function topSeoTraffic(queries: SeoQuery[], limit = 5) {
  return [...queries].sort((a, b) => b.clicks - a.clicks).slice(0, limit);
}

export function topSeoPages(pages: SeoPage[], limit = 5) {
  return [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, limit);
}

export function seoStrengths(queries: SeoQuery[]) {
  return [...queries]
    .filter((item) => item.clicks > 0 && item.position <= 10)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);
}

export function seoOpportunities(queries: SeoQuery[]) {
  return [...queries]
    .filter(
      (item) =>
        item.impressions >= 20 &&
        item.position > 3 &&
        item.position <= 20,
    )
    .sort((a, b) => {
      const scoreA = a.impressions * Math.max(0, 12 - a.position) * (1 - a.ctr);
      const scoreB = b.impressions * Math.max(0, 12 - b.position) * (1 - b.ctr);
      return scoreB - scoreA;
    })
    .slice(0, 6);
}

export function seoWeaknesses(queries: SeoQuery[]) {
  return [...queries]
    .filter((item) => item.impressions >= 30 && item.position > 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);
}

export function seoSummary(queries: SeoQuery[]) {
  const totalClicks = queries.reduce((sum, item) => sum + item.clicks, 0);
  const totalImpressions = queries.reduce((sum, item) => sum + item.impressions, 0);
  const top10Clicks = queries
    .filter((item) => item.position <= 10)
    .reduce((sum, item) => sum + item.clicks, 0);

  return {
    totalClicks,
    totalImpressions,
    top10Clicks,
    top10ClickShare: totalClicks > 0 ? top10Clicks / totalClicks : 0,
    queryCount: queries.length,
  };
}
