import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const WORDPRESS_SITE_URL = "https://www.delagraineaujardin.com";
const REQUEST_TIMEOUT_MS = 10000;

export interface WordPressItem {
  id: number;
  title: string;
  link: string;
  date: string;
  modified: string;
}

export interface WordPressCollection {
  total: number | null;
  items: WordPressItem[];
  error: string | null;
}

export interface WordPressOverview {
  siteUrl: string;
  reachable: boolean;
  responseTimeMs: number | null;
  siteName: string | null;
  siteDescription: string | null;
  posts: WordPressCollection;
  pages: WordPressCollection;
  checkedAt: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&nbsp;": " ",
};

/** WordPress renvoie les titres avec des entités HTML : on les décode en texte brut. */
function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|nbsp);|&#039;/g, (match) => ENTITIES[match] ?? match);
}

async function fetchJson(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${WORDPRESS_SITE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const elapsed = Date.now() - startedAt;
    const body: unknown = await response.json().catch(() => null);
    return { response, body, elapsed, error: null as string | null };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Le site ne répond pas après 10 secondes."
        : "Site injoignable.";
    return { response: null, body: null, elapsed: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCollection(type: "posts" | "pages"): Promise<WordPressCollection> {
  const result = await fetchJson(
    `/wp-json/wp/v2/${type}?per_page=5&orderby=modified&order=desc&_fields=id,date,modified,link,title`,
  );
  if (result.error || !result.response) {
    return { total: null, items: [], error: result.error };
  }
  if (!result.response.ok || !Array.isArray(result.body)) {
    return {
      total: null,
      items: [],
      error: `API REST WordPress indisponible pour les ${type === "posts" ? "articles" : "pages"} (HTTP ${result.response.status}).`,
    };
  }
  const totalHeader = Number(result.response.headers.get("X-WP-Total"));
  const items = (
    result.body as Array<{
      id: number;
      link: string;
      date: string;
      modified: string;
      title?: { rendered?: string };
    }>
  ).map((item) => ({
    id: item.id,
    link: item.link,
    date: item.date,
    modified: item.modified,
    title: decodeEntities(item.title?.rendered ?? "(sans titre)"),
  }));
  return {
    total: Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : items.length,
    items,
    error: null,
  };
}

/**
 * Lecture seule des données publiques du site WordPress (aucun identifiant requis) :
 * état de l'API REST, temps de réponse, derniers articles et pages modifiés.
 * Les mises à jour de plugins et le diagnostic de santé WordPress exigent un mot de
 * passe d'application et ne sont pas lus ici.
 */
export const getWordPressOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WordPressOverview> => {
    const root = await fetchJson("/wp-json/");
    const rootBody =
      root.body && typeof root.body === "object"
        ? (root.body as { name?: string; description?: string })
        : null;
    const reachable = Boolean(root.response?.ok && rootBody);

    const [posts, pages] = reachable
      ? await Promise.all([loadCollection("posts"), loadCollection("pages")])
      : [
          {
            total: null,
            items: [],
            error: root.error ?? "API REST WordPress non détectée sur ce site.",
          },
          {
            total: null,
            items: [],
            error: root.error ?? "API REST WordPress non détectée sur ce site.",
          },
        ];

    return {
      siteUrl: WORDPRESS_SITE_URL,
      reachable,
      responseTimeMs: root.elapsed,
      siteName: rootBody?.name ? decodeEntities(rootBody.name) : null,
      siteDescription: rootBody?.description ? decodeEntities(rootBody.description) : null,
      posts,
      pages,
      checkedAt: new Date().toISOString(),
    };
  });
