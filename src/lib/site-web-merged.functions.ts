import { createServerFn } from "@tanstack/react-start";
import { mergeSiteWebData } from "@/lib/site-web-merger";
import { getSiteWebExternalSources } from "@/lib/site-web-sources.functions";
import { siteWebDemoModel } from "@/lib/site-web-model";

/**
 * Get merged Site web model (external + demo).
 * If external sources fail or are not connected,
 * returns demo data with source = "demo".
 */
export const getMergedSiteWebModel = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const result = await getSiteWebExternalSources();

      if (result.success && result.data) {
        return {
          success: true,
          model: mergeSiteWebData({
            gsc: result.data.gsc,
            analytics: result.data.analytics,
            bp: result.data.bp,
          }),
          sourcesConnected: result.data.allConnected,
          error: null,
        };
      }

      // External sources failed or not connected → return demo
      return {
        success: true,
        model: siteWebDemoModel,
        sourcesConnected: false,
        error: result.error,
      };
    } catch (error) {
      console.error("[Site web] Failed to get merged model:", error);
      // Graceful fallback to demo
      return {
        success: true,
        model: siteWebDemoModel,
        sourcesConnected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);
