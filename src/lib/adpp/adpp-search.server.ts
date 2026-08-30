/**
 * Recherche web gratuite (DuckDuckGo HTML) pour ADPP.
 * Lecture seule, aucune clé d'API, aucun service payant.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function realUrl(href: string): string {
  const match = href.match(/uddg=([^&]+)/);
  const raw = match ? decodeURIComponent(match[1]!) : href;
  return raw.startsWith("//") ? `https:${raw}` : raw;
}

export async function webSearch(query: string, limit = 5): Promise<WebSearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; PilotPro/1.0)",
    },
    body: `q=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Recherche web indisponible (${response.status})`);
  const html = await response.text();

  const results: WebSearchResult[] = [];
  const blockRegex =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null && results.length < limit) {
    const url = realUrl(match[1]!);
    const title = decode(match[2]!);
    if (!title || !url.startsWith("http")) continue;
    results.push({ title, url, snippet: decode(match[3] ?? "") });
  }
  return results;
}
