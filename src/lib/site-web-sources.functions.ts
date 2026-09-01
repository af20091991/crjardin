import { createServerFn } from "@tanstack/react-start";
import {
  loadAnalyticsData,
  loadBusinessProfileData,
  loadSearchConsoleData,
  mergeSiteWebSources,
} from "./site-web-integrations.server";

export const getSiteWebExternalSources = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const sources = await mergeSiteWebSources();
      return { success: true, data: sources, error: null };
    } catch (error) {
      console.error("[Site web] Failed to load external sources:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

export const getSiteWebSearchConsoleData = createServerFn(
  { method: "GET" },
  async () => loadSearchConsoleData(),
);

export const getSiteWebAnalyticsData = createServerFn(
  { method: "GET" },
  async () => loadAnalyticsData(),
);

export const getSiteWebBusinessProfileData = createServerFn(
  { method: "GET" },
  async () => loadBusinessProfileData(),
);
