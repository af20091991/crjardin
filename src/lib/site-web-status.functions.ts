import { createServerFn } from "@tanstack/react-start";
import { getSiteWebSourcesStatus } from "@/lib/site-web-env";

/**
 * Get status of all configured data sources.
 * Used in dashboard to show connection status.
 */
export const getSiteWebSourcesStatus = createServerFn(
  { method: "GET" },
  async () => getSiteWebSourcesStatus(),
);
