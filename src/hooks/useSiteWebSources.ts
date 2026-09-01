import { useSuspenseQuery } from "@tanstack/react-query";
import { getSiteWebExternalSources } from "@/lib/site-web-sources.functions";

/**
 * Hook to load all external sources.
 * Uses TanStack Query with suspense boundary.
 * Falls back to demo data if sources unavailable.
 */
export function useSiteWebSources() {
  return useSuspenseQuery({
    queryKey: ["site-web-sources"],
    queryFn: () => getSiteWebExternalSources(),
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
