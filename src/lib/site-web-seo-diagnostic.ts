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

export type SeoChange = {
  key: string;
  current: number;
  previous: number;
  change: number | null;
};

const numberValue = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function aggregateSeoQueries(rows: SeoQueryRow[]): SeoQuery[] {
  return aggregate(rows, 0, "query");
}

export function aggregateSeoPages(rows: SeoQueryRow[]): SeoPage[] {
  return aggregate(rows, 1, "page");
}

function aggregate<T extends SeoQuery | SeoPage>(
  rows: SeoQueryRow[],
  keyIndex: number,
  kind: "query" | "page",
): T[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  rows.forEach((row) => {
    const key = (row.keys?.[keyIndex] ?? "").trim();
    if (!key) return;
    const clicks = numberValue(row.clicks);
    const impressions = numberValue(row.impressions);
    const position = numberValue(row.position);
    const current = map.get(key) ?? { clicks: 0, impressions: 0, positionWeighted: 0 };
    current.clicks += clicks;
    current.impressions += impressions;
    current.positionWeighted += position * impressions;
    map.set(key, current);
  });

  return [...map.entries()].map(([key, value]) => {
    const base = {
      clicks: value.clicks,
      impressions: value.impressions,
      ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
      position: value.impressions > 0 ? value.positionWeighted / value.impressions : 0,
    };
    return (kind === "query" ? { query: key, ...base } : { page: key, ...base }) as T;
  });
}

export function compareSeoQueries(currentRows: SeoQueryRow[], previousRows: SeoQueryRow[]): SeoChange[] {
  return compareAggregates(aggregateSeoQueries(currentRows), aggregateSeoQueries(previousRows), "query");
}

export function compareSeoPages(currentRows: SeoQueryRow[], previousRows: SeoQueryRow[]): SeoChange[] {
  return compareAggregates(aggregateSeoPages(currentRows), aggregateSeoPages(previousRows), "page");
}

function compareAggregates(
  current: Array<SeoQuery | SeoPage>,
  previous: Array<SeoQuery | SeoPage>,
  key: "query" | "page",
): SeoChange[] {
  const previousMap = new Map(previous.map((item) => [item[key], item.clicks]));
  return current.map((item) => {
    const previousClicks = previousMap.get(item[key]) ?? 0;
    return {
      key: item[key],
      current: item.clicks,
      previous: previousClicks,
      change: previousClicks > 0 ? (item.clicks - previousClicks) / previousClicks : null,
    };
  });
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
        item.impressions >= 30 &&
        item.position > 3 &&
        item.position <= 20 &&
        item.ctr < 0.08,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 6);
}

export function seoPageOpportunities(pages: SeoPage[]) {
  return [...pages]
    .filter(
      (item) =>
        item.impressions >= 50 &&
        item.position > 3 &&
        item.position <= 15 &&
        item.ctr < 0.08,
    )
    .sort((a, b) => b.impressions - a.impressions)
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

export function significantChanges(changes: SeoChange[], limit = 5) {
  return [...changes]
    .filter((item) => item.previous >= 5 && item.change !== null && Math.abs(item.change) >= 0.2)
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, limit);
}
