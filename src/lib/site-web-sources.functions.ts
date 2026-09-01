import { createServerFn } from "@tanstack/react-start";
import {
  loadSearchConsoleData,
  loadAnalyticsData,
  loadBusinessProfileData,
  mergeSiteWebSources,
} from "./site-web-integrations.server";

/**
 * Server function to load all external sources.
 * Called from client-side components.
 * Returns merged data or demo data if sources unavailable.
 */
export const getSiteWebExternalSources = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const sources = await mergeSiteWebSources();
      return {
        success: true,
        data: sources,
        error: null,
      };
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

/**
 * Server function to load only Search Console data.
 */
export const getSiteWebSearchConsoleData = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const data = await loadSearchConsoleData();
      return {
        success: data !== null,
        data,
        error: data === null ? "Search Console not connected" : null,
      };
    } catch (error) {
      console.error("[Site web] Failed to load Search Console data:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Server function to load only Analytics data.
 */
export const getSiteWebAnalyticsData = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const data = await loadAnalyticsData();
      return {
        success: data !== null,
        data,
        error: data === null ? "Analytics not connected" : null,
      };
    } catch (error) {
      console.error("[Site web] Failed to load Analytics data:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Server function to load only Business Profile data.
 */
export const getSiteWebBusinessProfileData = createServerFn(
  { method: "GET" },
  async () => {
    try {
      const data = await loadBusinessProfileData();
      return {
        success: data !== null,
        data,
        error: data === null ? "Business Profile not connected" : null,
      };
    } catch (error) {
      console.error("[Site web] Failed to load Business Profile data:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);
