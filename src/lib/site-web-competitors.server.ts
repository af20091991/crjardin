import { createClient } from "@supabase/supabase-js";
import {
  analyzeContent,
  analyzeFiles,
  analyzeHomepage,
} from "@/lib/site-web-competitor-analysis.server";
import type { CompetitorDetails, PageSpeedDetails } from "@/lib/site-web-competitor-types";

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export interface CompetitorCheckRow {
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  ssl_ok: boolean;
  response_time_ms: number | null;
  error: string | null;
  details: CompetitorDetails | null;
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

type LighthouseAudit = {
  title?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  numericValue?: number;
  details?: { type?: string; overallSavingsMs?: number };
};

type PageSpeedBody = {
  error?: { message?: string };
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, { percentile?: number }>;
  };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null; auditRefs?: Array<{ id: string }> }>;
    audits?: Record<string, LighthouseAudit>;
  };
};

async function runPageSpeed(domain: string) {
  const url = new URL(PAGESPEED_ENDPOINT);
  url.searchParams.set("url", `https://${domain}`);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.set("locale", "fr");
  for (const category of ["performance", "seo", "accessibility", "best-practices"]) {
    url.searchParams.append("category", category);
  }
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  const body = (await response.json().catch(() => null)) as PageSpeedBody | null;
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
  const audits = body?.lighthouseResult?.audits ?? {};
  const score = (key: string) =>
    typeof categories[key]?.score === "number" ? Math.round(categories[key].score! * 100) : null;
  const numeric = (id: string) =>
    typeof audits[id]?.numericValue === "number" ? audits[id].numericValue! : null;
  const rounded = (value: number | null) => (value == null ? null : Math.round(value));

  const failedIn = (categoryKey: string) =>
    (categories[categoryKey]?.auditRefs ?? [])
      .map((ref) => audits[ref.id])
      .filter(
        (audit): audit is LighthouseAudit =>
          Boolean(audit?.title) &&
          typeof audit.score === "number" &&
          audit.score < 1 &&
          ["binary", "numeric", "metricSavings"].includes(audit.scoreDisplayMode ?? ""),
      )
      .map((audit) => audit.title as string)
      .slice(0, 6);

  const opportunities = Object.values(audits)
    .filter((audit) => (audit.details?.overallSavingsMs ?? 0) > 100 && audit.title)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 4)
    .map((audit) => ({
      title: audit.title as string,
      savings_ms: Math.round(audit.details?.overallSavingsMs ?? 0),
    }));

  const fieldMetrics = body?.loadingExperience?.metrics;
  const field = fieldMetrics
    ? {
        category: body?.loadingExperience?.overall_category ?? null,
        lcp_ms: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
        cls:
          typeof fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === "number"
            ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : null,
        inp_ms: fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      }
    : null;

  const cls = numeric("cumulative-layout-shift");
  const weight = numeric("total-byte-weight");
  const pagespeed: PageSpeedDetails = {
    metrics: {
      fcp_ms: rounded(numeric("first-contentful-paint")),
      lcp_ms: rounded(numeric("largest-contentful-paint")),
      tbt_ms: rounded(numeric("total-blocking-time")),
      cls: cls == null ? null : Math.round(cls * 1000) / 1000,
      speed_index_ms: rounded(numeric("speed-index")),
      server_response_ms: rounded(numeric("server-response-time")),
      page_weight_kb: weight == null ? null : Math.round(weight / 1024),
    },
    field,
    seo_issues: failedIn("seo"),
    accessibility_issues: failedIn("accessibility"),
    best_practices_issues: failedIn("best-practices"),
    opportunities,
  };
  return {
    performance_score: score("performance"),
    seo_score: score("seo"),
    accessibility_score: score("accessibility"),
    best_practices_score: score("best-practices"),
    pagespeed,
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
  const [pageSpeed, timing, homepage, files] = await Promise.all([
    runPageSpeed(domain).catch(() => ({ error: "Analyse PageSpeed impossible pour le moment." })),
    checkSslAndTiming(domain),
    analyzeHomepage(domain),
    analyzeFiles(domain),
  ]);
  const content = await analyzeContent(domain, homepage.looksLikeWordPress);
  const failed = "error" in pageSpeed;
  const details: CompetitorDetails = {
    version: 1,
    pagespeed: failed ? null : pageSpeed.pagespeed,
    page: homepage.page,
    http: homepage.http,
    files,
    content,
  };
  return {
    performance_score: failed ? null : pageSpeed.performance_score,
    seo_score: failed ? null : pageSpeed.seo_score,
    accessibility_score: failed ? null : pageSpeed.accessibility_score,
    best_practices_score: failed ? null : pageSpeed.best_practices_score,
    ssl_ok: timing.ssl_ok,
    response_time_ms: timing.response_time_ms,
    error: failed ? pageSpeed.error : null,
    details,
  };
}
