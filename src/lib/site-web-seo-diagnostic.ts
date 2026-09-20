export type SeoQueryRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
export type SeoQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type SeoPage = { page: string; clicks: number; impressions: number; ctr: number; position: number };
export type SeoAction = { query: string; type: "quick-win" | "content" | "local" | "authority"; title: string; reason: string; target: string; score: number };

const numberValue = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? number : 0; };

export function aggregateSeoQueries(rows: SeoQueryRow[]): SeoQuery[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();
  rows.forEach((row) => {
    const query = (row.keys?.[0] ?? "").trim();
    if (!query) return;
    const clicks = numberValue(row.clicks);
    const impressions = numberValue(row.impressions);
    const position = numberValue(row.position);
    const current = map.get(query) ?? { clicks: 0, impressions: 0, positionWeighted: 0 };
    current.clicks += clicks; current.impressions += impressions; current.positionWeighted += position * impressions;
    map.set(query, current);
  });
  return [...map.entries()].map(([query, value]) => ({
    query, clicks: value.clicks, impressions: value.impressions,
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
    current.clicks += clicks; current.impressions += impressions; current.positionWeighted += position * impressions;
    map.set(page, current);
  });
  return [...map.entries()].map(([page, value]) => ({
    page, clicks: value.clicks, impressions: value.impressions,
    ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
    position: value.impressions > 0 ? value.positionWeighted / value.impressions : 0,
  }));
}

export function topSeoTraffic(queries: SeoQuery[], limit = 5) { return [...queries].sort((a, b) => b.clicks - a.clicks).slice(0, limit); }
export function topSeoPages(pages: SeoPage[], limit = 5) { return [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, limit); }
export function seoStrengths(queries: SeoQuery[]) { return [...queries].filter((item) => item.clicks > 0 && item.position <= 10).sort((a, b) => b.clicks - a.clicks).slice(0, 5); }
export function seoOpportunities(queries: SeoQuery[]) {
  return [...queries].filter((item) => item.impressions >= 20 && item.position > 3 && item.position <= 20).sort((a, b) => {
    const scoreA = a.impressions * Math.max(0, 12 - a.position) * (1 - a.ctr);
    const scoreB = b.impressions * Math.max(0, 12 - b.position) * (1 - b.ctr);
    return scoreB - scoreA;
  }).slice(0, 6);
}
export function seoWeaknesses(queries: SeoQuery[]) { return [...queries].filter((item) => item.impressions >= 30 && item.position > 10).sort((a, b) => b.impressions - a.impressions).slice(0, 5); }
export function seoSummary(queries: SeoQuery[]) {
  const totalClicks = queries.reduce((sum, item) => sum + item.clicks, 0);
  const totalImpressions = queries.reduce((sum, item) => sum + item.impressions, 0);
  const top10Clicks = queries.filter((item) => item.position <= 10).reduce((sum, item) => sum + item.clicks, 0);
  return { totalClicks, totalImpressions, top10Clicks, top10ClickShare: totalClicks > 0 ? top10Clicks / totalClicks : 0, queryCount: queries.length };
}

function isLocalQuery(query: string) { return /\b(montpellier|castelnau|lattes|pérols|perols|juvignac|grabels|clapiers|saint[- ]?gély|34)\b/i.test(query); }
function isCommercialQuery(query: string) { return /\b(paysagiste|jardinier|entretien|aménagement|amenagement|création|creation|conseil|jardin méditerranéen|jardin sec|arrosage|extérieur|exterieur)\b/i.test(query); }

function actionForQuery(item: SeoQuery): SeoAction | null {
  const local = isLocalQuery(item.query);
  const commercial = isCommercialQuery(item.query);
  if (item.position > 3 && item.position <= 10 && item.impressions >= 20 && item.ctr < 0.08) {
    return {
      query: item.query, type: local ? "local" : "quick-win",
      title: local ? "Renforcer la page locale" : "Améliorer le résultat Google",
      reason: `${formatInteger(item.impressions)} impressions, position ${formatPosition(item.position)} et CTR ${formatPercent(item.ctr)} : la visibilité existe déjà mais le résultat capte encore peu de clics.`,
      target: local ? "Page locale / Google Business Profile" : "Title + meta description + contenu de la page positionnée",
      score: item.impressions * (1 - item.ctr) * Math.max(1, 11 - item.position),
    };
  }
  if (item.impressions >= 30 && item.position > 10 && item.position <= 30 && commercial) {
    return {
      query: item.query, type: local ? "local" : "content",
      title: local ? "Créer ou renforcer une page locale" : "Renforcer le contenu ciblé",
      reason: `${formatInteger(item.impressions)} impressions mais position ${formatPosition(item.position)} : Google teste déjà cette intention sans encore bien classer le site.`,
      target: local ? "Contenu local réellement utile, sans page locale artificielle" : "Article ou page service répondant précisément à la requête",
      score: item.impressions * Math.max(1, 31 - item.position),
    };
  }
  if (item.impressions >= 50 && item.position > 20) {
    return {
      query: item.query, type: local ? "local" : commercial ? "authority" : "content",
      title: local ? "Développer la couverture locale" : "Développer la couverture thématique",
      reason: `${formatInteger(item.impressions)} impressions avec une position moyenne de ${formatPosition(item.position)} : la demande existe, mais le site manque encore de visibilité.`,
      target: local ? "Contenu local + signaux Google Business Profile" : "Contenu expert + maillage interne depuis les pages déjà visibles",
      score: item.impressions,
    };
  }
  return null;
}

export function seoActions(queries: SeoQuery[], limit = 6): SeoAction[] {
  const actions = queries.map(actionForQuery).filter((item): item is SeoAction => item !== null);
  const seen = new Set<string>();
  return actions.sort((a, b) => b.score - a.score).filter((item) => {
    const key = item.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function formatInteger(value: number) { return new Intl.NumberFormat("fr-FR").format(Math.round(value)); }
function formatPosition(value: number) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value); }
function formatPercent(value: number) { return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value); }
