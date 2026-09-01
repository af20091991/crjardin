import { siteWebDemoModel } from "@/lib/site-web-model";
import type {
  SearchConsoleData,
  AnalyticsData,
  BusinessProfileData,
  SiteWebModel,
} from "@/lib/site-web-model";

/**
 * Merge external data with demo data.
 * External data takes precedence over demo when available.
 * Preserves demo data as fallback.
 */
export function mergeSiteWebData(
  external: {
    gsc: SearchConsoleData | null;
    analytics: AnalyticsData | null;
    bp: BusinessProfileData | null;
  },
): SiteWebModel {
  const merged = { ...siteWebDemoModel };

  // Merge Search Console data (requêtes)
  if (external.gsc) {
    merged.requetes = external.gsc.requetes.map((q) => ({
      ...q,
      source: "search_console" as const,
    }));
  }

  // Merge Analytics data (statistiques)
  if (external.analytics) {
    merged.statistiques = external.analytics.statistiques.map((s) => ({
      ...s,
      source: "analytics" as const,
    }));
  }

  // Merge Business Profile data (SEO local)
  if (external.bp) {
    merged.seoLocal = {
      ...external.bp,
      source: "business_profile" as const,
    };
  }

  return merged;
}

/**
 * Get a single source status string.
 */
export function getSourceStatus(
  type: "search_console" | "analytics" | "business_profile" | "demo",
): string {
  const statuses: Record<string, string> = {
    search_console: "Connectée",
    analytics: "Connectée",
    business_profile: "Connectée",
    demo: "Démonstration",
  };
  return statuses[type] ?? "Unknown";
}

/**
 * Determine which source contributed most data.
 */
export function getPrimarySource(
  model: SiteWebModel,
): "demo" | "search_console" | "analytics" | "business_profile" {
  // Count non-demo items
  const externalCount = [
    ...model.requetes,
    ...model.statistiques,
    model.seoLocal,
  ].filter((item: any) => item.source !== "demo").length;

  if (externalCount === 0) return "demo";

  // Return first non-demo source found
  if (model.requetes.some((q) => q.source === "search_console")) {
    return "search_console";
  }
  if (model.statistiques.some((s) => s.source === "analytics")) {
    return "analytics";
  }
  if (model.seoLocal.source === "business_profile") {
    return "business_profile";
  }

  return "demo";
}
