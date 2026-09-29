import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORDPRESS_SITE_URL } from "@/lib/site-web-wordpress.functions";

const REQUEST_TIMEOUT_MS = 12000;

export type HealthStatus = "good" | "recommended" | "critical" | "unknown";

export interface WordPressHealthTest {
  id: string;
  label: string;
  status: HealthStatus;
  description: string;
}

export interface WordPressPlugin {
  slug: string;
  name: string;
  version: string;
  active: boolean;
  latestVersion: string | null;
  updateAvailable: boolean | null;
}

export interface WordPressAdminOverview {
  configured: boolean;
  error: string | null;
  core: {
    installedVersion: string | null;
    latestVersion: string | null;
    updateAvailable: boolean | null;
  };
  health: WordPressHealthTest[];
  plugins: WordPressPlugin[];
  theme: { name: string; version: string } | null;
  checkedAt: string;
}

const HEALTH_TESTS = [
  "background-updates",
  "loopback-requests",
  "https-status",
  "dotorg-communication",
  "authorization-header",
] as const;

function basicAuth(user: string, password: string) {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `Basic ${btoa(binary)}`;
}

async function request(url: string, authorization?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PilotPro-Veille/1.0",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body, text };
  } catch {
    return { ok: false, status: 0, body: null, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function versionParts(version: string) {
  return version
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
}

/** true si `latest` est strictement plus récente que `installed`. */
function isNewer(latest: string, installed: string) {
  const a = versionParts(latest);
  const b = versionParts(installed);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

async function detectCoreVersion() {
  const feed = await request(`${WORDPRESS_SITE_URL}/feed/`);
  const fromFeed = feed.text.match(/wordpress\.org\/\?v=([0-9][0-9.]*)/i)?.[1];
  if (fromFeed) return fromFeed;
  const home = await request(`${WORDPRESS_SITE_URL}/`);
  return home.text.match(/<meta[^>]+generator[^>]+WordPress\s+([0-9][0-9.]*)/i)?.[1] ?? null;
}

async function latestCoreVersion() {
  const result = await request("https://api.wordpress.org/core/version-check/1.7/");
  const offers = (result.body as { offers?: Array<{ current?: string }> } | null)?.offers;
  return offers?.[0]?.current ?? null;
}

async function latestPluginVersion(slug: string) {
  const result = await request(`https://api.wordpress.org/plugins/info/1.0/${slug}.json`);
  const version = (result.body as { version?: unknown } | null)?.version;
  return result.ok && typeof version === "string" ? version : null;
}

function authFailureMessage(status: number) {
  if (status === 401) {
    return "Identifiants WordPress refusés : vérifie le nom d'utilisateur et le mot de passe d'application (ou l'hébergeur bloque l'en-tête Authorization).";
  }
  if (status === 403) {
    return "Le compte WordPress n'a pas les droits nécessaires : utilise un compte administrateur.";
  }
  if (status === 404) return "API REST WordPress introuvable sur ce site.";
  if (status === 429) {
    return "Trop de requêtes envoyées d'affilée : le site limite temporairement l'accès. Réessaie dans une minute.";
  }
  if (status === 0) return "Le site WordPress ne répond pas.";
  return `Lecture des extensions impossible (HTTP ${status}).`;
}

/**
 * Lecture seule de l'administration WordPress via l'API REST authentifiée
 * (mot de passe d'application) : santé du site, extensions, thème, version du cœur.
 * Aucune requête d'écriture n'est émise. Les identifiants restent côté serveur.
 */
export const getWordPressAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WordPressAdminOverview> => {
    const user = process.env.WORDPRESS_USERNAME;
    const password = process.env.WORDPRESS_APP_PASSWORD;
    const empty = {
      core: { installedVersion: null, latestVersion: null, updateAvailable: null },
      health: [],
      plugins: [],
      theme: null,
      checkedAt: new Date().toISOString(),
    };
    if (!user || !password) return { configured: false, error: null, ...empty };

    const authorization = basicAuth(user, password);
    const api = `${WORDPRESS_SITE_URL}/wp-json`;

    const pluginsResult = await request(`${api}/wp/v2/plugins?per_page=100`, authorization);
    if (!pluginsResult.ok || !Array.isArray(pluginsResult.body)) {
      return {
        configured: true,
        error: authFailureMessage(pluginsResult.status),
        ...empty,
      };
    }

    const rawPlugins = pluginsResult.body as Array<{
      plugin?: string;
      name?: string;
      version?: string;
      status?: string;
    }>;

    // Requêtes vers le site espacées (limites anti-bot de l'hébergeur) ; les appels vers
    // api.wordpress.org (cœur, extensions) ne comptent pas et restent en parallèle.
    const healthResults: Awaited<ReturnType<typeof request>>[] = [];
    for (const id of HEALTH_TESTS) {
      if (healthResults.length > 0) await new Promise((resolve) => setTimeout(resolve, 250));
      healthResults.push(await request(`${api}/wp-site-health/v1/tests/${id}`, authorization));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    const themeResult = await request(`${api}/wp/v2/themes?status=active`, authorization);
    const [installedCore, latestCore, pluginVersions] = await Promise.all([
      detectCoreVersion(),
      latestCoreVersion(),
      Promise.all(
        rawPlugins.map((plugin) => latestPluginVersion((plugin.plugin ?? "").split("/")[0])),
      ),
    ]);

    const health: WordPressHealthTest[] = HEALTH_TESTS.map((id, index) => {
      const result = healthResults[index];
      const body = result.body as {
        label?: string;
        status?: string;
        description?: string;
      } | null;
      if (!result.ok || !body) {
        return {
          id,
          label: id,
          status: "unknown",
          description: "Test indisponible (droits insuffisants ou test non supporté).",
        };
      }
      const status: HealthStatus =
        body.status === "good" || body.status === "recommended" || body.status === "critical"
          ? body.status
          : "unknown";
      return {
        id,
        label: stripHtml(body.label ?? id),
        status,
        description: stripHtml(body.description ?? "").slice(0, 280),
      };
    });

    const plugins: WordPressPlugin[] = rawPlugins.map((plugin, index) => {
      const slug = (plugin.plugin ?? "").split("/")[0];
      const version = plugin.version ?? "";
      const latest = pluginVersions[index];
      return {
        slug,
        name: stripHtml(plugin.name ?? slug),
        version,
        active: plugin.status === "active" || plugin.status === "network-active",
        latestVersion: latest,
        updateAvailable: latest && version ? isNewer(latest, version) : null,
      };
    });

    const activeTheme = Array.isArray(themeResult.body)
      ? (themeResult.body[0] as { name?: { raw?: string; rendered?: string }; version?: string })
      : null;

    return {
      configured: true,
      error: null,
      core: {
        installedVersion: installedCore,
        latestVersion: latestCore,
        updateAvailable: installedCore && latestCore ? isNewer(latestCore, installedCore) : null,
      },
      health,
      plugins,
      theme: activeTheme
        ? {
            name: stripHtml(activeTheme.name?.raw ?? activeTheme.name?.rendered ?? "Thème actif"),
            version: activeTheme.version ?? "",
          }
        : null,
      checkedAt: new Date().toISOString(),
    };
  });
