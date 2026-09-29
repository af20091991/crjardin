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

export interface WordPressCoreInfo {
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
}

export interface WordPressOverview {
  siteUrl: string;
  reachable: boolean;
  responseTimeMs: number | null;
  siteName: string | null;
  siteDescription: string | null;
  core: WordPressCoreInfo;
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

async function fetchRaw(url: string, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { response, text: await response.text().catch(() => "") };
  } catch {
    return { response: null, text: "" };
  } finally {
    clearTimeout(timeout);
  }
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

function versionParts(version: string) {
  return version
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
}

/** true si `latest` est strictement plus récente que `installed`. */
function isNewerVersion(latest: string, installed: string) {
  const a = versionParts(latest);
  const b = versionParts(installed);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Version du cœur WordPress lue sur des pages publiques (flux RSS, balise generator) : aucune authentification nécessaire. */
async function detectInstalledCoreVersion() {
  const feed = await fetchRaw(`${WORDPRESS_SITE_URL}/feed/`, 6000);
  const fromFeed = feed.text.match(/wordpress\.org\/\?v=([0-9][0-9.]*)/i)?.[1];
  if (fromFeed) return fromFeed;
  const home = await fetchRaw(`${WORDPRESS_SITE_URL}/`, 6000);
  return home.text.match(/<meta[^>]+generator[^>]+WordPress\s+([0-9][0-9.]*)/i)?.[1] ?? null;
}

async function detectLatestCoreVersion() {
  const result = await fetchRaw("https://api.wordpress.org/core/version-check/1.7/", 6000);
  try {
    const offers = (JSON.parse(result.text) as { offers?: Array<{ current?: string }> })?.offers;
    return offers?.[0]?.current ?? null;
  } catch {
    return null;
  }
}

async function loadCoreInfo(reachable: boolean): Promise<WordPressCoreInfo> {
  if (!reachable) return { installedVersion: null, latestVersion: null, updateAvailable: null };
  const [installed, latest] = await Promise.all([
    detectInstalledCoreVersion(),
    detectLatestCoreVersion(),
  ]);
  return {
    installedVersion: installed,
    latestVersion: latest,
    updateAvailable: installed && latest ? isNewerVersion(latest, installed) : null,
  };
}

async function loadCollection(type: "posts" | "pages"): Promise<WordPressCollection> {
  const result = await fetchJson(
    `/wp-json/wp/v2/${type}?per_page=5&orderby=modified&order=desc&_fields=id,date,modified,link,title`,
  );
  if (result.error || !result.response) {
    return { total: null, items: [], error: result.error };
  }
  if (!result.response.ok || !Array.isArray(result.body)) {
    if (result.response.status === 429) {
      return {
        total: null,
        items: [],
        error:
          "Trop de requêtes envoyées d'affilée : le site limite temporairement l'accès. Réessaie dans une minute.",
      };
    }
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

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const notDetected: WordPressCollection = {
      total: null,
      items: [],
      error: root.error ?? "API REST WordPress non détectée sur ce site.",
    };
    let posts: WordPressCollection = notDetected;
    let pages: WordPressCollection = notDetected;
    let core: WordPressCoreInfo = {
      installedVersion: null,
      latestVersion: null,
      updateAvailable: null,
    };
    if (reachable) {
      posts = await loadCollection("posts");
      await delay(250);
      pages = await loadCollection("pages");
      await delay(250);
      core = await loadCoreInfo(reachable);
    }

    return {
      siteUrl: WORDPRESS_SITE_URL,
      reachable,
      responseTimeMs: root.elapsed,
      siteName: rootBody?.name ? decodeEntities(rootBody.name) : null,
      siteDescription: rootBody?.description ? decodeEntities(rootBody.description) : null,
      core,
      posts,
      pages,
      checkedAt: new Date().toISOString(),
    };
  });
