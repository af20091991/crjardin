import { createClient } from "@supabase/supabase-js";

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export interface CompetitorCheckRow {
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  ssl_ok: boolean;
  response_time_ms: number | null;
  error: string | null;
  checked_at: string;
}

export interface CompetitorRow {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  lastCheck: CompetitorCheckRow | null;
}

/**
 * Client service-role volontairement non typé : les tables de veille concurrentielle
 * ne figurent pas dans `types.ts` (fichier auto-généré, non modifié à la main).
 */
export function competitorsDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante.");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Normalise une saisie (URL ou domaine) et refuse tout ce qui n'est pas un nom de domaine public. */
export function normalizeDomain(input: string): string | null {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "");
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

async function runPageSpeed(domain: string) {
  const url = new URL(PAGESPEED_ENDPOINT);
  url.searchParams.set("url", `https://${domain}`);
  url.searchParams.set("strategy", "mobile");
  for (const category of ["performance", "seo", "accessibility", "best-practices"]) {
    url.searchParams.append("category", category);
  }
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    lighthouseResult?: { categories?: Record<string, { score?: number | null }> };
  } | null;
  if (!response.ok) {
    const message = body?.error?.message ?? "";
    if (response.status === 429 || /quota/i.test(message)) {
      return {
        error: apiKey
          ? "Quota PageSpeed dépassé pour aujourd'hui : réessaie demain."
          : "Quota PageSpeed partagé dépassé : ajoute une clé PAGESPEED_API_KEY pour analyser les scores.",
      };
    }
    return { error: message || `PageSpeed indisponible (HTTP ${response.status}).` };
  }
  const categories = body?.lighthouseResult?.categories ?? {};
  const score = (key: string) =>
    typeof categories[key]?.score === "number" ? Math.round(categories[key].score! * 100) : null;
  return {
    performance_score: score("performance"),
    seo_score: score("seo"),
    accessibility_score: score("accessibility"),
    best_practices_score: score("best-practices"),
  };
}

async function checkSslAndTiming(domain: string) {
  const startedAt = Date.now();
  try {
    // Un certificat invalide ou expiré fait échouer fetch : une réponse HTTPS valide = SSL OK.
    await fetch(`https://${domain}`, { method: "GET", redirect: "follow" });
    return { ssl_ok: true, response_time_ms: Date.now() - startedAt };
  } catch {
    return { ssl_ok: false, response_time_ms: null };
  }
}

export async function runCompetitorCheck(domain: string) {
  const [pageSpeed, timing] = await Promise.all([runPageSpeed(domain), checkSslAndTiming(domain)]);
  const failed = "error" in pageSpeed;
  return {
    performance_score: failed ? null : pageSpeed.performance_score,
    seo_score: failed ? null : pageSpeed.seo_score,
    accessibility_score: failed ? null : pageSpeed.accessibility_score,
    best_practices_score: failed ? null : pageSpeed.best_practices_score,
    ssl_ok: timing.ssl_ok,
    response_time_ms: timing.response_time_ms,
    error: failed ? pageSpeed.error : null,
  };
}
