import type { ContentInfo, FilesInfo, HttpInfo, PageInfo } from "@/lib/site-web-competitor-types";

const USER_AGENT = "PilotPro-Veille/1.0";
const MAX_HTML_BYTES = 1_500_000;
const MAX_XML_BYTES = 1_000_000;

type TimedInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

async function timedFetch(url: string, init: TimedInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...init.headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Lit au plus `maxBytes` octets du corps de la réponse (évite de charger un fichier énorme). */
async function readCapped(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return { text: await response.text(), bytes: 0 };
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return { text, bytes };
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function tagAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return attributes;
}

function collectTypes(node: unknown, into: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectTypes(item, into));
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") into.add(type);
  if (Array.isArray(type)) type.forEach((t) => typeof t === "string" && into.add(t));
  if (record["@graph"]) collectTypes(record["@graph"], into);
}

function parseHomepage(html: string, host: string): PageInfo {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metas = (html.match(/<meta\s[^>]*>/gi) ?? []).map(tagAttributes);
  const metaContent = (key: string) =>
    metas.find((m) => m.name?.toLowerCase() === key || m.property?.toLowerCase() === key)?.content;
  const links = (html.match(/<link\s[^>]*>/gi) ?? []).map(tagAttributes);
  const canonical = links.find((l) => l.rel?.toLowerCase() === "canonical")?.href ?? null;
  const robots = metaContent("robots")?.toLowerCase() ?? "";

  const jsonLdTypes = new Set<string>();
  for (const block of html.matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      collectTypes(JSON.parse(block[1]), jsonLdTypes);
    } catch {
      // JSON-LD invalide : ignoré.
    }
  }

  const images = html.match(/<img\s[^>]*>/gi) ?? [];
  let internal = 0;
  let external = 0;
  for (const anchor of html.matchAll(/<a\s[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (anchor[1] ?? anchor[2] ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
      let linkHost = "";
      try {
        linkHost = new URL(href.startsWith("//") ? `https:${href}` : href).hostname;
      } catch {
        continue;
      }
      if (linkHost.replace(/^www\./, "") === host.replace(/^www\./, "")) internal += 1;
      else external += 1;
    } else {
      internal += 1;
    }
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const words = decodeEntities(text).split(/\s+/).filter(Boolean).length;

  return {
    title: titleMatch ? decodeEntities(titleMatch[1]) || null : null,
    meta_description: metaContent("description")
      ? decodeEntities(metaContent("description")!)
      : null,
    h1_count: (html.match(/<h1[\s>]/gi) ?? []).length,
    h2_count: (html.match(/<h2[\s>]/gi) ?? []).length,
    canonical,
    lang: html.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i)?.[1] ?? null,
    noindex: robots.includes("noindex"),
    viewport: metas.some((m) => m.name?.toLowerCase() === "viewport"),
    open_graph: Boolean(metaContent("og:title") && metaContent("og:image")),
    json_ld_types: [...jsonLdTypes].slice(0, 8),
    generator: metaContent("generator") ? decodeEntities(metaContent("generator")!) : null,
    images_total: images.length,
    images_without_alt: images.filter((tag) => !/\salt\s*=/i.test(tag)).length,
    internal_links: internal,
    external_links: external,
    word_count: words,
  };
}

export async function analyzeHomepage(domain: string): Promise<{
  page: PageInfo | null;
  http: HttpInfo | null;
  looksLikeWordPress: boolean;
}> {
  try {
    const [response, httpProbe] = await Promise.all([
      timedFetch(`https://${domain}`, {
        headers: { Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
      }),
      timedFetch(`http://${domain}`, { redirect: "manual" }, 6000).catch(() => null),
    ]);
    const { text: html, bytes } = await readCapped(response, MAX_HTML_BYTES);
    const location = httpProbe?.headers.get("location") ?? "";
    const httpsRedirect = httpProbe
      ? httpProbe.status >= 300 && httpProbe.status < 400 && location.startsWith("https://")
      : null;
    const host = new URL(response.url || `https://${domain}`).hostname;
    return {
      page: parseHomepage(html, host),
      http: {
        final_url: response.url || `https://${domain}`,
        status: response.status,
        https_redirect: httpsRedirect,
        hsts: response.headers.has("strict-transport-security"),
        server: response.headers.get("server"),
        html_size_kb: Math.round(bytes / 1024),
      },
      looksLikeWordPress: /wp-content\/|wp-includes\//i.test(html),
    };
  } catch {
    return { page: null, http: null, looksLikeWordPress: false };
  }
}

function countLocs(xml: string) {
  return (xml.match(/<loc>/gi) ?? []).length;
}

export async function analyzeFiles(domain: string): Promise<FilesInfo> {
  const base = `https://${domain}`;
  let robotsTxt: boolean | null = null;
  let sitemapUrl: string | null = null;
  try {
    const robots = await timedFetch(`${base}/robots.txt`, {}, 6000);
    const { text } = await readCapped(robots, 200_000);
    robotsTxt = robots.ok && /user-agent\s*:/i.test(text);
    if (robotsTxt) {
      sitemapUrl = text.match(/^\s*sitemap\s*:\s*(\S+)/im)?.[1] ?? null;
    }
  } catch {
    robotsTxt = null;
  }

  const candidates = [
    ...(sitemapUrl ? [sitemapUrl] : []),
    `${base}/sitemap.xml`,
    `${base}/wp-sitemap.xml`,
    `${base}/sitemap_index.xml`,
  ];
  for (const candidate of candidates) {
    try {
      const response = await timedFetch(candidate, {}, 6000);
      if (!response.ok) continue;
      const { text } = await readCapped(response, MAX_XML_BYTES);
      if (!/<(urlset|sitemapindex)/i.test(text)) continue;
      if (/<sitemapindex/i.test(text)) {
        const children = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
          .map((m) => m[1])
          .slice(0, 6);
        const counts = await Promise.all(
          children.map(async (child) => {
            try {
              const childResponse = await timedFetch(child, {}, 6000);
              if (!childResponse.ok) return 0;
              return countLocs((await readCapped(childResponse, MAX_XML_BYTES)).text);
            } catch {
              return 0;
            }
          }),
        );
        return {
          robots_txt: robotsTxt,
          sitemap_url: candidate,
          sitemap_urls: counts.reduce((sum, n) => sum + n, 0),
        };
      }
      return { robots_txt: robotsTxt, sitemap_url: candidate, sitemap_urls: countLocs(text) };
    } catch {
      continue;
    }
  }
  return { robots_txt: robotsTxt, sitemap_url: null, sitemap_urls: null };
}

/** Activité éditoriale via l'API REST publique WordPress (si le site en expose une). */
export async function analyzeContent(
  domain: string,
  looksLikeWordPress: boolean,
): Promise<ContentInfo | null> {
  const base = `https://${domain}/wp-json/wp/v2/posts`;
  try {
    const latest = await timedFetch(`${base}?per_page=1&orderby=date&order=desc&_fields=id,date`, {
      headers: { Accept: "application/json" },
    });
    const body: unknown = await latest.json().catch(() => null);
    if (!latest.ok || !Array.isArray(body)) {
      return looksLikeWordPress
        ? { is_wordpress: true, posts_total: null, last_post_date: null, posts_last_90_days: null }
        : null;
    }
    const total = Number(latest.headers.get("X-WP-Total"));
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const recent = await timedFetch(
      `${base}?per_page=1&after=${encodeURIComponent(since)}&_fields=id`,
      {
        headers: { Accept: "application/json" },
      },
    ).catch(() => null);
    const recentTotal = recent?.ok ? Number(recent.headers.get("X-WP-Total")) : NaN;
    return {
      is_wordpress: true,
      posts_total: Number.isFinite(total) ? total : null,
      last_post_date: (body[0] as { date?: string } | undefined)?.date ?? null,
      posts_last_90_days: Number.isFinite(recentTotal) ? recentTotal : null,
    };
  } catch {
    return looksLikeWordPress
      ? { is_wordpress: true, posts_total: null, last_post_date: null, posts_last_90_days: null }
      : null;
  }
}
