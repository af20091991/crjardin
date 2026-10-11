import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeFiles,
  analyzeHomepage,
} from "@/lib/site-web-competitor-analysis.server";
import type {
  FilesInfo,
  HttpInfo,
  PageInfo,
} from "@/lib/site-web-competitor-types";

const SITE_DOMAIN = "www.delagraineaujardin.com";
const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

type MetricValue = { percentile?: number };
type PageSpeedResponse = {
  error?: { message?: string };
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, MetricValue>;
  };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, { numericValue?: number }>;
  };
};

export interface SiteWebTechnicalAudit {
  checkedAt: string;
  page: PageInfo | null;
  http: HttpInfo | null;
  files: FilesInfo | null;
  pageSpeed: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    fieldCategory: string | null;
    fieldLcpMs: number | null;
    fieldInpMs: number | null;
    fieldCls: number | null;
    labLcpMs: number | null;
    labInpMs: number | null;
    labCls: number | null;
    labFcpMs: number | null;
    labTbtMs: number | null;
  } | null;
  pageSpeedError: string | null;
}

async function loadPageSpeed() {
  const url = new URL(PAGESPEED_ENDPOINT);
  url.searchParams.set("url", `https://${SITE_DOMAIN}/`);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.set("locale", "fr");
  for (const category of ["performance", "seo", "accessibility", "best-practices"]) {
    url.searchParams.append("category", category);
  }
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const body = (await response.json().catch(() => null)) as PageSpeedResponse | null;
    if (!response.ok) {
      const message = body?.error?.message ?? `PageSpeed indisponible (HTTP ${response.status}).`;
      return { data: null, error: message };
    }

    const experience = body?.loadingExperience;
    const field = experience?.metrics ?? {};
    const audits = body?.lighthouseResult?.audits ?? {};
    const categories = body?.lighthouseResult?.categories ?? {};
    const score = (key: string) => {
      const value = categories[key]?.score;
      return typeof value === "number" ? Math.round(value * 100) : null;
    };
    const auditNumber = (key: string) =>
      typeof audits[key]?.numericValue === "number" ? audits[key].numericValue! : null;
    const percentile = (key: string) =>
      typeof field[key]?.percentile === "number" ? field[key].percentile! : null;

    return {
      data: {
        performance: score("performance"),
        seo: score("seo"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        fieldCategory: experience?.overall_category ?? null,
        fieldLcpMs: percentile("LARGEST_CONTENTFUL_PAINT_MS"),
        fieldInpMs: percentile("INTERACTION_TO_NEXT_PAINT"),
        fieldCls: (() => {
          const value = percentile("CUMULATIVE_LAYOUT_SHIFT_SCORE");
          return value == null ? null : value / 1000;
        })(),
        labLcpMs: auditNumber("largest-contentful-paint"),
        labInpMs: auditNumber("interaction-to-next-paint"),
        labCls: auditNumber("cumulative-layout-shift"),
        labFcpMs: auditNumber("first-contentful-paint"),
        labTbtMs: auditNumber("total-blocking-time"),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "L’analyse PageSpeed a dépassé 25 secondes."
          : "Impossible de joindre PageSpeed Insights.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const getSiteWebTechnicalAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SiteWebTechnicalAudit> => {
    const [homepage, files, speed] = await Promise.all([
      analyzeHomepage(SITE_DOMAIN).catch(() => ({
        page: null,
        http: null,
        looksLikeWordPress: false,
      })),
      analyzeFiles(SITE_DOMAIN).catch(() => null),
      loadPageSpeed(),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      page: homepage.page,
      http: homepage.http,
      files,
      pageSpeed: speed.data,
      pageSpeedError: speed.error,
    };
  });
